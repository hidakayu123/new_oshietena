from django.shortcuts import render
import json
import os
from django.http import JsonResponse, StreamingHttpResponse
from app.ai_search_service import (process_target_index, summarize_vector_results)
from app.open_ai_service import (handle_chatbot_response, stream_chatbot_response)
from new_oshietena.const import (CONTENT_FILTER_ERROR_MESSAGE, OTHERS_ERROR_MESSAGE)
from django.contrib.auth.decorators import login_required
from app.get_chat_history import fetch_history_for_user
from app.save_chat import create_new_conversation
from django.views.decorators.csrf import csrf_exempt

# def home(request):
#     return render(request, 'chat.html')

def auth_setup(request):
    """
    フロントエンドに認証設定を返すためのAPIビュー
    """
    try:
        # サーバー側の環境変数から設定値を読み込む
        client_id = os.environ.get("VITE_APP_CLIENT_ID")
        tenant_id = os.environ.get("VITE_APP_TENANT_ID")
        redirect_uri = os.environ.get("VITE_APP_REDIRECT_URI")

        # フロントエンドに渡す設定オブジェクトを組み立てる
        response_data = {
            "useLogin": True, # ログイン機能を使うかどうか
            "requireAccessControl": True,
            "enableUnauthenticatedAccess": False,
            "msalConfig": {
                "auth": {
                    "clientId": client_id,
                    "authority": f"https://login.microsoftonline.com/{tenant_id}",
                    "redirectUri": redirect_uri,
                    "postLogoutRedirectUri": "/",
                    "navigateToLoginRequestUrl": True,
                },
                "cache": {
                    "cacheLocation": "sessionStorage",
                    "storeAuthStateInCookie": False,
                }
            },
            # 必要に応じて他の設定も追加
        }
        return JsonResponse(response_data)

    except Exception as e:
        print(f"Error in auth_setup view: {e}")
        return JsonResponse({'error': 'Configuration failed.'}, status=500)
    
# チャット処理
@login_required
def chatbot(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            messages = data.get("messages", [])
            user_id = request.user.username    

            # user_id（メールアドレス）から@より前の部分を抽出してtarget_indexとする
            try:
                target_index = user_id.split('@')[0]
            except IndexError:
                # @が含まれないなど、予期せぬ形式の場合はそのままuser_idをフォールバックとして使用
                target_index = user_id

            # ユーザーの質問を抽出する
            user_question = ""
            if isinstance(messages, list): # messagesがリストであることを確認
                for message in messages:
                    if message.get("role") == "user":
                        user_question = message.get("content")
                        break # ユーザーの質問を見つけたらループを抜ける

            if target_index:
                anser = process_target_index(user_question, target_index)
                vector_summary = summarize_vector_results(anser)
                messages.append({
                    "role": "system",
                    "content": f"以下は関連情報です:\n{vector_summary}"
                })
                response = handle_chatbot_response(messages)

            return StreamingHttpResponse(
                stream_chatbot_response(messages, response),
                content_type="text/event-stream",
            )
        except Exception as e:
            # エラーメッセージを適切にフォーマットする
            if hasattr(e, "code") and e.code == "content_filter":
                message = CONTENT_FILTER_ERROR_MESSAGE
            else:
                message = OTHERS_ERROR_MESSAGE
            return JsonResponse(
                {"message": message},
                status=e.status_code,
            )

# チャット履歴取得処理
@login_required
def get_chat_history(request):
    """
    ログインしているユーザーのチャット履歴を返すAPIビュー。
    実際のデータ取得処理はChatHistoryServiceに委任する。
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'GET method required.'}, status=405)

    try:
        user_id = request.user.username
        
        # サービスレイヤーの関数を呼び出して、ビジネスロジックを実行
        history_items = fetch_history_for_user(user_id=user_id)
        
        # 成功した結果をJSONで返す
        return JsonResponse({'history': history_items})

    except Exception as e:
        # サービスレイヤーで発生したエラーをキャッチして、HTTPエラーとして返す
        print(f"Error in get_chat_history view: {e}")
        return JsonResponse({'error': 'Internal Server Error'}, status=500)
    
# チャット履歴保存処理
@login_required
@csrf_exempt
def savechat(request):
    """
    新しい会話を保存するAPIビュー。
    実際のデータ保存処理はChatHistoryServiceに委任する。
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method Not Allowed'}, status=405)

    try:
        # リクエストからデータを取得
        data = json.loads(request.body)
        conversation_id = data.get('conversationId')
        question = data.get('question')
        answer = data.get('answer')
        
        # ログインしているユーザーIDを取得
        user_id = request.user.username

        # 必須データが揃っているかチェック
        if not (user_id and conversation_id and question and answer):
            return JsonResponse({'error': 'Missing required data'}, status=400)

        # サービスレイヤーの関数を呼び出して、ビジネスロジックを実行
        created_item = create_new_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
            question=question,
            answer=answer
        )
        
        # 成功した結果をJSONで返す
        return JsonResponse(created_item, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format'}, status=400)
    except Exception as e:
        # サービスレイヤーで発生したエラーをキャッチして、HTTPエラーとして返す
        print(f"Error in savechat view: {e}")
        return JsonResponse({'error': 'Internal Server Error'}, status=500)

def get_config(request):
    """
    フロントエンドが必要とする設定情報を返すビュー
    """
    # .envファイルからフロントエンドに渡したい設定値を取得
    # 例：Azure OpenAIのエンドポイントや、Entra IDのクライアントIDなど
    config_data = {
        'azure_openai_endpoint': os.environ.get('AZURE_OPENAI_ENDPOINT'),
        'entra_id_client_id': os.environ.get('ENTRA_ID_CLIENT_ID'),
        # その他、フロントエンドで必要な設定があればここに追加
    }
    
    return JsonResponse(config_data)