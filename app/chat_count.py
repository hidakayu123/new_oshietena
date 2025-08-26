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
    authentication_classes = [AzureADJWTAuthentication]  # Azure AD JWT認証を使用
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not client:
            # Cosmos DBクライアントの初期化に失敗している場合
            return JsonResponse({"error": "Database connection failed"}, status=500)

        # ユーザーID
        user_id = request.user.username
        print("ユーザーです", user_id)

        try:
            # --- Cosmos DBへのパラメータ化クエリ作成 ---
            # ユーザの利用期間取得
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
            print(items)

            if items:
                term = items[0]['AvailableTerm']
                start_of_month_utc = term['start']
                end_of_period_utc = term['end']
            else:
                raise ValueError(f"AvailableTerm not found for user_id={user_id}")
            
            # 利用期間内のチャット回数取得
            query_count = (
                "SELECT VALUE COUNT(1) FROM c "
                "WHERE c.userId = @userId "
                "AND c.createdAt >= @start_date "
                "AND c.createdAt <= @end_date"
            )

            parameters = [
                {"name": "@userId", "value": user_id},
                {"name": "@start_date", "value": start_of_month_utc},
                {"name": "@end_date", "value": end_of_period_utc},
            ]

            count_items = list(container.query_items(
                query=query_count,
                parameters=parameters,
                partition_key=user_id  
            ))

            count = count_items[0] if count_items else 0

            # --- 使用上限の取得とレスポンス作成 ---
            limit_str = os.environ.get("CHAT_USAGE_LIMIT") 
            limit = int(limit_str)

            response_data = {
                "count": count,
                "limit": limit,
            }

            print(response_data)
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
