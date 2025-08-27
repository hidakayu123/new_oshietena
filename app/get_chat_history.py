from azure.cosmos import CosmosClient
import os
from azure.cosmos.exceptions import CosmosHttpResponseError

# --- Cosmos DB クライアント初期化コード ---
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
        user_id (str): 履歴を取得するユーザーのID。

    Returns:
        list: チャット履歴のリスト。各要素は辞書型。

    Raises:
        Exception: データベース接続が利用できない場合や、クエリ実行中にエラーが発生した場合。
    """
    if not container:
        raise Exception("Database connection is not available.")

    query = """
    SELECT c.id, c.title, c.historyBoxId
    FROM c
    WHERE c.userId = @userid
    AND NOT IS_DEFINED(c.AvailableTerm)
    ORDER BY c.createdAt DESC
    """

    parameters = [{"name": "@userid", "value": user_id}]

    try:
        items = list(
            container.query_items(
                query=query,
                parameters=parameters,
                # enable_cross_partition_query=True,
                partition_key=user_id  
            )
        )
        return items
    except CosmosHttpResponseError as e:
        # 特定の Cosmos DB エラーは無視し、空リストを返す
        print(f"Cosmos DB query failed (ignored): {e}")
        return []
    except Exception as e:
        print(f"Database query failed for user {user_id}: {e}")
        raise


def fetch_single_chat_by_id(user_id, history_box_id):
    """
    指定ユーザーのチャット履歴から単一のチャットを取得する関数。

    Args:
        user_id: ユーザーID
        history_box_id: チャットの一塊

    Returns:
        list or None: チャット履歴のリストまたは None
    """
    try:
        client = CosmosClient(ENDPOINT, credential=KEY)
        db = client.get_database_client(DATABASE_NAME)
        container = db.get_container_client(CONTAINER_NAME)

        query = """
        SELECT c.id, c.question, c.answer
        FROM c
        WHERE c.userId = @userId AND c.historyBoxId = @historyBoxId
        AND NOT IS_DEFINED(c.AvailableTerm)
        ORDER BY c.createdAt DESC
        """
        parameters = [{"name": "@userId", "value": user_id},{"name": "@historyBoxId", "value": history_box_id}]

        items = list(
            container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id  
            )
        )
        print(items)
        return items if items else None

    except Exception as e:
        print("🔥 fetch_single_chat_by_id error:", repr(e))
        raise
