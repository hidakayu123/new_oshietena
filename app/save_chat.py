import datetime
import os
import datetime
from azure.cosmos import CosmosClient

# --- ここに初期化コードを移動する ---
ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT")
KEY = os.environ.get("COSMOS_DB_KEY")
DATABASE_NAME = 'YourDatabaseName'
CONTAINER_NAME = 'Conversations'

try:
    client = CosmosClient(ENDPOINT, credential=KEY)
    database = client.get_database_client(DATABASE_NAME)
    container = database.get_container_client(CONTAINER_NAME)
    print("Cosmos DB client initialized successfully in services.py.")
except Exception as e:
    print(f"Cosmos DB client initialization failed: {e}")
    container = None


def create_new_conversation(user_id: str, conversation_id: str, question: dict, answer: dict) -> dict:
    """
    新しい会話をデータベースに作成します。

    Args:
        user_id (str): ユーザーID
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
        'userId': user_id,  # これがパーティションキー
        'title': question.get('content', '新規チャット')[:30], # 質問の冒頭をタイトルにする
        'question': question,
        'answer': answer,
        'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    try:
        # Cosmos DBにアイテムを作成（保存）
        created_item = container.create_item(body=new_item)
        return created_item
    except Exception as e:
        print(f"Database item creation failed: {e}")
        raise