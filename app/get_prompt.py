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

def get_prompt(user_id: str):
    """指定ユーザーのプロンプト一覧を Cosmos DB から取得"""
    try:
        query = """
        SELECT c.id, c.title, c.description
        FROM c
        WHERE c.userId = @user_id
        AND IS_DEFINED(c.title)
        AND IS_DEFINED(c.description)
        AND (NOT IS_NULL(c.title))
        AND (NOT IS_NULL(c.description))
        AND c.title != ""
        AND c.description != ""
        """
        parameters = [{"name": "@user_id", "value": user_id}]
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        prompts = [
            {
                "id": str(item.get("id")),
                "title": item.get("title", ""),
                "description": item.get("description", "")
            }
            for item in items
        ]
        print(f"✅ {len(prompts)} 件のプロンプト取得")
        return prompts

    except Exception as e:
        print(f"❌ fetch_prompts_by_user 失敗: {e}")
        return []