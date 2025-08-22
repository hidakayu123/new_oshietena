import os
import datetime
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions
import jwt  

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


def create_new_conversation(
    tenant_id: str,
    user_id: str,
    conversation_id: str,
    question: dict,
    answer: dict,
) -> dict:
    """
    新しい会話をデータベースに作成します。
    パーティションキーにはテナントIDを使用します。

    Args:
        tenant_id (str): 顧客のテナントID (パーティションキー)
        user_id (str): 質問したユーザーのID
        conversation_id (str): 新しい会話のID
        question (dict): ユーザーからの質問
        answer (dict): AIからの回答

    Returns:
        dict: 作成されたアイテムの情報
    
    Raises:
        Exception: DB接続不可、またはアイテム作成中にエラーが発生した場合
    """

    if not container:
        raise Exception("Database connection is not available.")

    new_item = {
        "id": conversation_id,
        "tenantId": tenant_id,
        "userId": user_id,
        "title": question[:30],  
        "question": question,
        "answer": answer.get("message", {}).get("content", ""),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "type": "conversation",
    }

    try:
        created_item = container.create_item(body=new_item)
        return created_item
    except Exception as e:
        print("❌ チャット保存失敗:", e)
        raise


def handle_msal_callback(id_token_str: str) -> dict:
    """
    MSALからのIDトークンを受け取り、ログインまたは初回登録を処理します。

    Args:
        id_token_str (str): MSALから取得したIDトークン（JWT）

    Returns:
        dict: 処理結果のステータスとユーザー情報
    
    Raises:
        ValueError: トークンが無効、または必要な情報がない場合
        ConnectionError: DBコンテナ接続が利用できない場合
    """
    # トークンをデコード（署名検証は省略、実運用では必須）
    try:
        token_claims = jwt.decode(id_token_str, options={"verify_signature": False})
    except Exception:
        raise ValueError("無効なトークンです。")

    tenant_id = token_claims.get("tid")  # Azure AD テナントID
    user_oid = token_claims.get("oid")   # Azure AD ユーザーオブジェクトID
    user_name = token_claims.get("name")
    user_email = token_claims.get("preferred_username")

    if not tenant_id or not user_oid:
        raise ValueError("トークンに必要な情報が含まれていません。")

    if container is None:
        raise ConnectionError("データベースコンテナに接続できません。サーバーの構成を確認してください。")

    # ユーザー情報のUpsert (初回登録または更新)
    user_item = {
        "id": user_oid,
        "tenantId": tenant_id,
        "displayName": user_name,
        "email": user_email,
        "type": "user",
        "created_at": datetime.utcnow().isoformat(),
    }

    container.upsert_item(body=user_item)

    return {"status": "success", "userId": user_oid, "tenantId": tenant_id}
