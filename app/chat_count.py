import os
import datetime
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from azure.cosmos import CosmosClient, exceptions

# --- 環境変数からCosmos DBの接続情報を取得 ---
# .envファイルを使う場合は、python-dotenvライブラリなどで読み込む
ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT")
KEY = os.environ.get("COSMOS_DB_KEY")
DATABASE_NAME = 'YourDatabaseName'  # 実際のデータベース名に置き換えてください
CONTAINER_NAME = 'ChatHistory'      # 実際のコンテナ名に置き換えてください

# --- Cosmos DBクライアントの初期化 ---
# アプリケーション起動時に一度だけ初期化するのが効率的です
try:
    client = CosmosClient(ENDPOINT, credential=KEY)
    database = client.get_database_client(DATABASE_NAME)
    container = database.get_container_client(CONTAINER_NAME)
except Exception as e:
    # 接続情報が不正な場合などの初期化エラー
    print(f"Cosmos DB client initialization failed: {e}")
    client = None


@login_required # ログイン必須にするデコレータ
def chatcount(request):
    """
    ログインユーザーの当月のチャット利用回数をCosmos DBから取得する
    """
    if not client:
        # Cosmos DBクライアントの初期化に失敗している場合
        return JsonResponse({"error": "Database connection failed"}, status=500)

    # ユーザー個人のID (例: oidクレーム)
    user_id = request.user.username                      


    # --- 2. 当月の開始日と終了日を計算 ---
    today = datetime.date.today()
    # 月の初日
    start_of_month = today.replace(day=1)
    # 期間の終わりは「今日」
    end_of_period = today

    # UTCの正確な時刻に変換
    start_of_month_utc = datetime.datetime.combine(start_of_month, datetime.time.min).replace(tzinfo=datetime.timezone.utc)
    end_of_period_utc = datetime.datetime.combine(end_of_period, datetime.time.max).replace(tzinfo=datetime.timezone.utc)

    try:
        # --- 3. Cosmos DBへのクエリを作成 ---
        # SQLインジェクションを防ぐため、パラメータ化クエリを使用する
        query = (
            "SELECT VALUE COUNT(1) FROM c "
            "WHERE c.userId = @user_id "
            "AND c.createdAt >= @start_date "
            "AND c.createdAt <= @end_date"
        )

        # --- パラメータ: @company_idを追加し、日付をISO文字列に変更 ---
        parameters = [
            {"name": "@user_id", "value": user_id},
            {"name": "@start_date", "value": start_of_month_utc},
            {"name": "@end_date", "value": end_of_period_utc},
        ]

        # --- クエリの実行: partition_keyを指定して効率化 ---
        # このようにpartition_keyを明示的に指定することで、
        # Cosmos DBは単一パーティション内のみを検索し、高速に応答します。
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            partition_key=user_id
        ))

        # クエリの結果はリストで返ってくる（この場合は要素が1つのリスト）
        count = items[0] if items else 0

        # --- 5. 結果をJSONで返す ---
        limit_str = os.environ.get("CHAT_USAGE_LIMIT", "100") # デフォルト値を100に設定
        limit = int(limit_str) # 文字列を数値に変換
        
        response_data = {
            "count": count,
            "limit": limit
        }
        return JsonResponse(response_data)

    except exceptions.CosmosHttpResponseError as e:
        # Cosmos DBからのエラーレスポンス
        return JsonResponse({"error": f"Cosmos DB query failed: {e.message}"}, status=500)
    except Exception as e:
        # その他の予期せぬエラー
        return JsonResponse({"error": f"An unexpected error occurred: {str(e)}"}, status=500)

