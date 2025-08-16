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

def fetch_history_for_user(tenant_id: str) -> list:
    """
    指定されたユーザーのチャット履歴（IDとタイトル）をデータベースから取得します。

    Args:
        tenant_id  (str): 履歴を取得するユーザーのID。

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
    WHERE c.tenantId = @tenantId 
    ORDER BY c.createdAt DESC
    """
    
    parameters = [
    {"name": "@tenantId", "value": tenant_id}
    ]

    try:
        # パーティションキーを指定してクエリを実行し、結果をリストとして返す
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            partition_key=tenant_id
        ))
        return items
    except CosmosHttpResponseError as e:
        # Cosmos DBの特定のエラー（404やインデックスエラー）を無視して空リスト返す
        print(f"Cosmos DB query failed (ignored): {e}")
        return []
    except Exception as e:
        print(f"Database query failed for user {tenant_id}: {e}")
        raise