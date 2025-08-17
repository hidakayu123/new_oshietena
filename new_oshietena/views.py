from django.shortcuts import render
import json
import os
from django.http import JsonResponse, StreamingHttpResponse
from app.ai_search_service import (process_target_index, summarize_vector_results)
from app.open_ai_service import (handle_chatbot_response, stream_chatbot_response)
from new_oshietena.const import (CONTENT_FILTER_ERROR_MESSAGE, OTHERS_ERROR_MESSAGE)
from django.contrib.auth.decorators import login_required
from app.get_chat_history import fetch_history_for_user
from app.save_chat import (create_new_conversation, handle_msal_callback)
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import traceback
from django.views.decorators.csrf import ensure_csrf_cookie
from functools import wraps
import jwt
import requests
from datetime import datetime
from azure.cosmos import CosmosClient

import traceback
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
# def home(request):
#     return render(request, 'chat.html')

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

@ensure_csrf_cookie
def get_csrf_token(request):
    """
    このビューは、クライアントにCSRFクッキーを送信するためだけに存在します。
    """
    return JsonResponse({"detail": "CSRF cookie set"})

def auth_setup(request):
    """
    フロントエンドに認証設定を返すためのAPIビュー
    """
    try:
        # サーバー側の環境変数から設定値を読み込む
        client_id = os.environ.get("VITE_APP_CLIENT_ID")
        systena_tenant_id = os.environ.get("VITE_APP_TENANT_ID")
        redirect_uri = os.environ.get("VITE_APP_REDIRECT_URI")
        
        # フロントエンドに渡す設定オブジェクトを組み立てる
        response_data = {
            "useLogin": True, # ログイン機能を使うかどうか
            "requireAccessControl": True,
            "enableUnauthenticatedAccess": False,
            "msalConfig": {
                "auth": {
                    "clientId": client_id,
                    "authority": f"https://login.microsoftonline.com/{systena_tenant_id}",
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
    

# --- この部分は実際の環境に合わせて設定してください ---
client_id = os.environ.get("VITE_APP_CLIENT_ID")
systena_tenant_id = os.environ.get("VITE_APP_TENANT_ID")

# Microsoftの公開鍵を取得するためのエンドポイント
JWKS_URL = f"https://login.microsoftonline.com/{systena_tenant_id}/discovery/v2.0/keys"

# グローバルキャッシュとして公開鍵を保持
jwks_cache = {}

def get_signing_key(token):
    """
    JWTのヘッダーからkid（Key ID）を取得し、JWKSエンドポイントから
    対応する署名検証用の公開鍵を取得する。
    """
    global jwks_cache
    try:
        # JWKSをキャッシュから取得、なければリクエスト
        if not jwks_cache:
            response = requests.get(JWKS_URL)
            response.raise_for_status()
            jwks_cache = response.json()

        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks_cache["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
        
        if rsa_key:
            return jwt.algorithms.RSAAlgorithm.from_jwk(rsa_key)
        else:
            raise Exception("Signing key not found in JWKS.")

    except Exception as e:
        # エラーが発生した場合、キャッシュをクリアして再試行を促す
        jwks_cache = {}
        raise e

def token_required(view_func):
    print("OKKOOOOO")
    print("凸れーた called")
    """
    AuthorizationヘッダーのJWTトークンを検証するカスタムデコレータ
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if 'Authorization' not in request.headers:
            return JsonResponse({'error': 'Authorization header is missing'}, status=401)

        auth_header = request.headers['Authorization']
        try:
            scheme, token = auth_header.split(' ')
            if scheme.lower() != 'bearer':
                return JsonResponse({'error': 'Invalid token scheme'}, status=401)
        except ValueError:
            return JsonResponse({'error': 'Invalid token format'}, status=401)

        try:
            # 署名検証用の公開鍵を取得
            signing_key = get_signing_key(token)
            
            # JWTトークンをデコードして検証
            jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=f"https://sts.windows.net/{systena_tenant_id}/" 
            )
            
            # トークン検証OKならビューを呼ぶ
            return view_func(request, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return JsonResponse({'error': 'Token has expired'}, status=401)
        except jwt.InvalidTokenError as e:
            return JsonResponse({'error': f'Invalid token: {e}'}, status=401)
        except Exception as e:
            return JsonResponse({'error': f'An unexpected error occurred: {e}'}, status=500)

    return _wrapped_view


# チャット処理
@token_required
def chatbot(request):
    print("chatbot called")
    print(f"Request method: {request.method}")
    if request.method == "POST":
        try:
            print("Inside try block")
            data = json.loads(request.body)
            messages = data.get("messages", [])
            user_id = request.user.username    
            print(f"user_id: {user_id}")

            try:
                target_index = 'hidakayu'
                print(f"target_index: {target_index}")
            except IndexError:
                target_index = user_id
                return JsonResponse({'error': 'target_index is empty'}, status=400)

            user_question = ""
            if isinstance(messages, list):
                for message in messages:
                    if message.get("role") == "user":
                        user_question = message.get("content")
                        break

            print(f"user_question: {user_question}")

            if target_index:
                print("target_index exists, continuing")
                anser = process_target_index(user_question, target_index)
                vector_summary = summarize_vector_results(anser)
                messages.append({
                    "role": "system",
                    "content": f"以下は関連情報です:\n{vector_summary}"
                })
                response = handle_chatbot_response(messages)
                if not response:
                    return JsonResponse({'error': 'Failed to get chatbot response'}, status=500)

                print(response)
                return StreamingHttpResponse(
                    stream_chatbot_response(messages, response),
                    content_type="text/event-stream",
                )
            else:
                print("target_index is empty")

        except Exception as e:
            print(f"Exception: {e}")
            if hasattr(e, "code") and e.code == "content_filter":
                message = CONTENT_FILTER_ERROR_MESSAGE
            else:
                message = OTHERS_ERROR_MESSAGE
            return JsonResponse({"message": message}, status=getattr(e, 'status_code', 500))

    return JsonResponse({'error': 'Invalid request method'}, status=405)


# チャット履歴取得処理
def get_chat_history(request):
    """
    ログインしているユーザーのチャット履歴を返すAPIビュー。
    実際のデータ取得処理はChatHistoryServiceに委任する。
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'GET method required.'}, status=405)

    try:
        tenant_id = request.GET.get('tenant_id')
        
        # サービスレイヤーの関数を呼び出して、ビジネスロジックを実行
        history_items = fetch_history_for_user(tenant_id)
        # 成功した結果をJSONで返す
        return JsonResponse(history_items, safe=False)

    except Exception as e:
        # サービスレイヤーで発生したエラーをキャッチして、HTTPエラーとして返す
        print(f"Error in get_chat_history view: {e}")
        return JsonResponse({'error': 'Internal Server Error'}, status=500)
    
# チャット履歴保存処理
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
        tenant_id = data.get('tenant_id')
        
        # ログインしているユーザーIDを取得
        user_id = request.user.username

        # 必須データが揃っているかチェック
        if not (user_id and conversation_id and question and answer):
            return JsonResponse({'error': 'Missing required data'}, status=400)

        # サービスレイヤーの関数を呼び出して、ビジネスロジックを実行
        created_item = create_new_conversation(
            tenant_id=tenant_id,
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

@method_decorator(csrf_exempt, name='dispatch')
class MSALCallbackView(APIView):
    def post(self, request, *args, **kwargs):
        # ★★★ 1. postメソッドが呼び出されたことを確認 ★★★
        print("\n--- MSALCallbackView.post method reached ---")

        id_token = request.data.get('idToken')
        
        # ★★★ 2. 受け取ったIDトークンを確認 ★★★
        if id_token:
            print(f"Received ID Token (first 10 chars): {id_token[:10]}...")
        else:
            print("ID Token is missing from the request!")
            return Response(
                {"error": "ID token is missing."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ビジネスロジック関数を呼び出す
            session_info = handle_msal_callback(id_token_str=id_token)
            
            # ★★★ 3. 成功応答を返す直前のデータを確認 ★★★
            print(f"Success! Returning session info: {session_info}")
            
            return Response(session_info, status=status.HTTP_200_OK)

        except ValueError as e:
            # ★★★ 4. 想定内のエラー（トークン検証失敗など）をログに出力 ★★★
            print(f"!!! ValueError occurred: {e}")
            return Response({"error": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        
        except Exception as e:
            # ★★★ 5. 想定外のすべてのエラーをターミナルに強制出力 ★★★
            print("--- !!! UNEXPECTED ERROR IN MSALCallbackView !!! ---")
            traceback.print_exc()
            print("-------------------------------------------------")
            
            return Response({"error": "An internal error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)