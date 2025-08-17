import datetime
import os
import datetime
from azure.cosmos import CosmosClient, exceptions
import uuid
# 実際のアプリではPyJWTなどのライブラリを使ってトークンを検証・デコードします
import jwt 
from datetime import datetime, timezone

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


def create_new_conversation(tenant_id: str, user_id: str, conversation_id: str, question: dict, answer: dict) -> dict:
    print("🔧 create_new_conversation called")
    print("tenant_id:", tenant_id)
    print("user_id:", user_id)
    print("conversation_id:", conversation_id)
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

    # Cosmos DBに保存する新しいアイテムのオブジェクト（辞書）を作成
    new_item = {
        'id': conversation_id,
        # 変更点(1): パーティションキーとしてtenantIdを使用
        'tenantId': tenant_id,
        # 変更点(2): 誰が質問したか分かるようにuserIdは通常のプロパティとして保持
        'userId': user_id,
        'title': question[:30],
        'question': question,
        'answer': answer.get("message", {}).get("content", ""),
        'createdAt': datetime.now(timezone.utc).isoformat(),
        # 変更点(3): データの種類を示すtypeプロパティを追加（推奨）
        'type': 'conversation'
    }

    try:
        # Cosmos DBにアイテムを作成（保存）
        created_item = container.create_item(body=new_item)
        return created_item
    except Exception as e:
        print("❌ Error in create_new_conversation:", e)
        print(f"Database item creation failed: {e}")
        raise



# db_users と db_tenants はCosmos DBのコンテナオブジェクトとします

def handle_msal_callback(id_token_str: str) -> dict:
    """
    MSALからのIDトークンを受け取り、ログインまたは初回登録を処理します。
    """
    # 1. IDトークンをデコードして、中の情報（クレーム）を取得
    # 注：実際には、公開鍵を使ってトークンの署名を必ず検証する必要があります
    try:
        token_claims = jwt.decode(id_token_str, options={"verify_signature": False}) 
    except Exception as e:
        raise ValueError("無効なトークンです。")

    # 2. トークンから必須情報を抽出
    tenant_id = token_claims.get('tid')  # ★Azure ADのテナントID
    user_oid = token_claims.get('oid')    # ★Azure ADのユーザーオブジェクトID
    user_name = token_claims.get('name')
    user_email = token_claims.get('preferred_username')

    if not tenant_id or not user_oid:
        raise ValueError("トークンに必要な情報が含まれていません。")

    # グローバルなcontainerオブジェクトが利用可能かチェック
    if container is None:
        # 初期化に失敗していた場合、エラーを発生させる
        raise ConnectionError("データベースコンテナに接続できません。サーバーの構成を確認してください。")

    # 4. このユーザーが初めてアクセスしたか確認 (Upsert)
    user_item = {
        "id": user_oid,
        "tenantId": tenant_id,
        "displayName": user_name,
        "email": user_email,
        "type": "user",
        "created_at": datetime.utcnow().isoformat()
    }
    
    # この行でエラーが発生しなくなります
    container.upsert_item(body=user_item)

    # 5. どちらのケースでも、最終的にセッション情報を返す
    return {"status": "success", "userId": user_oid, "tenantId": tenant_id}