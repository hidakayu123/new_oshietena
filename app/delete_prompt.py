import os
import datetime
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions
import jwt  
import uuid
from azure.cosmos import exceptions

# --- Cosmos DB 初期化コード ---
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


def delete_prompt(user_id: str, prompt_id: str):
    """
    指定した user_id の prompt_id のドキュメントを削除する。
    """
    if container is None:
        raise Exception("Cosmos DB container not initialized")

    try:
        # Cosmos DB では id + partition_key（今回は userId）で指定して削除する
        container.delete_item(item=prompt_id, partition_key=user_id)
        print(f"✅ Prompt deleted: user_id={user_id}, prompt_id={prompt_id}")
        return True

    except exceptions.CosmosResourceNotFoundError:
        print(f"⚠️ Prompt not found: user_id={user_id}, prompt_id={prompt_id}")
        raise Exception("Prompt not found")

    except Exception as e:
        print(f"❌ Failed to delete prompt: {e}")
        raise
