import os
import datetime
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from azure.cosmos import CosmosClient, exceptions
from new_oshietena.authentication import AzureADJWTAuthentication

# --- 環境変数から Cosmos DB の接続情報を取得 ---
ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT")
KEY = os.environ.get("COSMOS_DB_KEY")
DATABASE_NAME = os.environ.get("DATABASE_NAME")
CONTAINER_NAME = os.environ.get("CONTAINER_NAME")

# --- Cosmos DB クライアントの初期化 ---
# アプリ起動時に一度だけ初期化するのが効率的
try:
    client = CosmosClient(ENDPOINT, KEY)
    database = client.get_database_client(DATABASE_NAME)
    container = database.get_container_client(CONTAINER_NAME)
except Exception as e:
    print(f"Cosmos DB client initialization failed: {e}")
    client = None


class ChatCountView(APIView):
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not client:
            return JsonResponse({"error": "Database connection failed"}, status=500)

        user_id = request.user.username
        url_name = request.resolver_match.url_name

        try:
            # --- 1. まず共通の利用期間を一度だけ取得する ---
            query_term = (
                "SELECT c.AvailableTerm FROM c "
                "WHERE c.AvailableuserId = @userId"
            )
            parameters = [{"name": "@userId", "value": user_id}]

            items = list(container.query_items(
                query=query_term,
                parameters=parameters,
                partition_key=user_id
            ))

            if not items:
                raise ValueError(f"AvailableTerm not found for user_id={user_id}")

            term = items[0]['AvailableTerm']
            start_iso_string = term['start'] # "2025-08-22T00:00:00Z"
            end_iso_string = term['end']

            # --- 2. URLのnameに応じて処理を分岐 ---
            if url_name == 'get_startday':
                # 'Z'を削除してPythonのdatetimeオブジェクトに変換
                start_datetime_obj = datetime.datetime.fromisoformat(start_iso_string.replace('Z', '+00:00'))
                
                # "yyyy-MM-dd" 形式の文字列にフォーマット
                start_day_formatted = start_datetime_obj.strftime('%Y-%m-%d')
                
                response_data = {"start_day": start_day_formatted}
                return JsonResponse(response_data)

            elif url_name == 'checkcount':
                # 利用期間内のチャット回数を取得
                query_count = (
                    "SELECT VALUE COUNT(1) FROM c "
                    "WHERE c.userId = @userId "
                    "AND c.createdAt >= @start_date "
                    "AND c.createdAt <= @end_date"
                )
                parameters_count = [
                    {"name": "@userId", "value": user_id},
                    {"name": "@start_date", "value": start_iso_string},
                    {"name": "@end_date", "value": end_iso_string},
                ]

                count_items = list(container.query_items(
                    query=query_count,
                    parameters=parameters_count,
                    partition_key=user_id
                ))
                count = count_items[0] if count_items else 0
                
                limit = int(os.environ.get("CHAT_USAGE_LIMIT", 0))

                response_data = {
                    "count": count,
                    "limit": limit,
                }
                return JsonResponse(response_data)

        except exceptions.CosmosHttpResponseError as e:
            # Cosmos DB からのエラー応答
            return JsonResponse(
                {"error": f"Cosmos DB query failed: {e.message}"}, status=500
            )
        except Exception as e:
            # 予期せぬエラー
            print("API /api/checkcount で予期せぬエラー:", e)
            return JsonResponse(
                {"error": f"An unexpected error occurred: {str(e)}"}, status=500
            )
