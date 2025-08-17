from azure.cosmos import CosmosClient
import os
from azure.cosmos.exceptions import CosmosHttpResponseError

# --- ここに初期化コードを移動する ---
ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT")
KEY = os.environ.get("COSMOS_DB_KEY")
DATABASE_NAME = os.environ.get("DATABASE_NAME")
CONTAINER_NAME = os.environ.get("CONTAINER_NAME")

try:
    client = CosmosClient(ENDPOINT, credential=KEY)
    database = client.get_database_client(DATABASE_NAME)
    container = database.get_container_client(CONTAINER_NAME)
    print("Cosmos DB client initialized successfully in services.py.")
except Exception as e:
    print(f"Cosmos DB client initialization failed: {e}")
    container = None

def fetch_history_for_user(user_id: str) -> list:
    """
    指定されたユーザーのチャット履歴（IDとタイトル）をデータベースから取得します。

    Args:
        user_id  (str): 履歴を取得するユーザーのID。

    Returns:
        list: チャット履歴のリスト。各要素は辞書型。
    
    Raises:
        Exception: データベース接続が利用できない場合や、クエリ実行中にエラーが発生した場合。
    """
    if not container:
        raise Exception("Database connection is not available.")

    # クエリを作成: userIdが一致するアイテムのidとtitleだけを取得
    query = """
    SELECT c.id, c.title 
    FROM c 
    WHERE c.userId  = @userid 
    ORDER BY c.createdAt DESC
    """
    
    parameters = [
    {"name": "@userid", "value": user_id}
    ]

    try:
        # パーティションキーを指定してクエリを実行し、結果をリストとして返す
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
            # partition_key=user_id
        ))
        return items
    except CosmosHttpResponseError as e:
        # Cosmos DBの特定のエラー（404やインデックスエラー）を無視して空リスト返す
        print(f"Cosmos DB query failed (ignored): {e}")
        return []
    except Exception as e:
        print(f"Database query failed for user {user_id}: {e}")
        raise

def fetch_single_chat_by_id(user_id, chat_id):
    try:
        print("📥 fetch_single_chat_by_id called")
        print(f"➡️ tenant_id: {user_id}, chat_id: {chat_id}")

        client = CosmosClient(ENDPOINT, credential=KEY)
        db = client.get_database_client(DATABASE_NAME)
        container = db.get_container_client(CONTAINER_NAME)

        query = "SELECT * FROM c WHERE c.id = @id AND c.userId = @userId"
        parameters = [
            {"name": "@id", "value": chat_id},
            {"name": "@userId", "value": user_id}
        ]

        print(f"🔍 Executing query: {query}")
        print(f"🔸 Parameters: {parameters}")

        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        print(f"✅ Query returned {len(items)} item(s)")

        if items:
            print(f"🟢 Found chat with id: {items[0].get('id', 'N/A')}")
        else:
            print("⚠️ No chat found matching criteria")

        return items[0] if items else None

    except Exception as e:
        print("🔥 fetch_single_chat_by_id error:", repr(e))
        raise
