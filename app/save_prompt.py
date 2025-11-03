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

def save_prompt(
    tenant_id: str,
    user_id: str,
    id: str | None,
    title: str,
    description: str,
) -> str:
    """プロンプトを Azure Cosmos DB に保存（新規 or 更新）"""

    if container is None:
        raise Exception("Cosmos DB container is not initialized.")

    # 1️⃣ 保存するデータ構造を定義
    now = datetime.now(timezone.utc).isoformat()

    new_prompt = {
        "id": id,
        "tenantId": tenant_id,
        "userId": user_id,
        "title": title,
        "description": description,
        "updatedAt": now,
    }

    try:
        # 2️⃣ 既存チェック
        existing_item = None
        try:
            existing_item = container.read_item(item=id, partition_key=user_id)
        except exceptions.CosmosResourceNotFoundError:
            pass  # 新規作成になる

        # 3️⃣ 更新 or 作成
        if existing_item:
            # 既存のアイテムを更新
            existing_item.update(new_prompt)
            container.upsert_item(existing_item)
            print(f"✅ Updated prompt in Cosmos DB: {title}")
        else:
            # 新しいアイテムを作成
            container.create_item(new_prompt)
            print(f"🆕 Created new prompt in Cosmos DB: {title}")

    except Exception as e:
        print(f"❌ Failed to save prompt: {e}")
        raise e
