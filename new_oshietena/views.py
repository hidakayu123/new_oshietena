import os
import json
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import openai 
from django.http import HttpResponse

# 認証クラスとサービス関数をインポート
from .authentication import AzureADJWTAuthentication
from app.open_ai_service import handle_chatbot_response, stream_chatbot_response
from app.ai_search_service import process_target_index, summarize_vector_results
from app.save_chat import create_new_conversation
from app.get_chat_history import fetch_history_for_user, fetch_single_chat_by_id
from app.save_prompt import save_prompt
from app.get_prompt import get_prompt
from django.views.generic import TemplateView
import traceback
from django.conf import settings
ERROR_MESSAGES_PATH = os.path.join(settings.BASE_DIR, "frontend/src/locales/ja/translation.json")

try:
    with open(ERROR_MESSAGES_PATH, "r", encoding="utf-8") as f:
        ERROR_MESSAGES = json.load(f)
except Exception as e:
    ERROR_MESSAGES = {}

class FrontendAppView(TemplateView):
    template_name = "index.html"


class ChatView(APIView):
    """チャットのストリーミング応答を処理するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            messages = request.data.get("messages", [])
            target_index = request.auth.get('oid')
            auth_header = request.headers.get('Authorization')
            csrf_token = request.headers.get('x-csrftoken')
            usage_start_date = request.headers.get('x-usage-startdate')
            if not messages:
                return Response({"error": "messages field is required."}, status=status.HTTP_400_BAD_REQUEST)

            user_question = ""
            if isinstance(messages, list): # messagesがリストであることを確認
                for message in messages:
                    if message.get("role") == "user":
                        user_question = message.get("content")
                        break # ユーザーの質問を見つけたらループを抜ける

            headers_for_apim = {
                'Authorization': auth_header,
                'Content-Type': 'application/json',
                'x-usage-startdate': usage_start_date,
                'x-csrftoken': csrf_token
            }

            if target_index:
                anser = process_target_index(user_question, target_index)
                print(anser)
                vector_summary = summarize_vector_results(anser)
                messages.append({
                    "role": "system",
                    "content": f"以下は関連情報です:\n{vector_summary}"
                })
                response = handle_chatbot_response(messages, headers_for_apim)
                return StreamingHttpResponse(
                stream_chatbot_response(messages, response),
                content_type="text/event-stream",
            )
        except openai.PermissionDeniedError as e:
            # メッセージに "quota" という単語が含まれているか確認
            if "quota" in str(e).lower():
                print(f"✅ クォータ上限エラー(403)を検出しました: {e}")
                # 画面には「利用回数上限」メッセージを返す
                return JsonResponse(
                    {"error": "rate_limit"},
                    status=429
                )
            else:
                # "quota" を含まない、純粋な権限エラーの場合
                print(f"❌ 権限エラー: {e}")
                return HttpResponse(
                    "APIへのアクセス権限がありません。",
                    status=403,
                    content_type="text/plain; charset=utf-8"
                )

        except Exception as e:
            # その他の予期せぬエラー
            print(f"💥 予期せぬエラー: {e}")
            return Response({"error": f"Chat processing error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        #===============================================================================================

class ChatHistoryView(APIView):
    """チャット履歴の取得と保存を処理するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        try:
            user_id = request.user.username
            chat_id = kwargs.get('chat_id')  # ← ここでURLのidパラメータを取得
            history_box_id = request.GET.get('historyBoxId')
            print(f"🧩 tenant_id: {user_id}, chat_id: {chat_id},historyBoxId: {history_box_id}")


            if chat_id:
                # 個別チャット取得
                item = fetch_single_chat_by_id(user_id, history_box_id)
                if item:
                    print("✅ 履歴取得")
                    return Response(item, status=status.HTTP_200_OK)
                else:
                    print("❌ チャット取得失敗: item is None")
                    return Response({"error": "指定されたチャットは見つかりませんでした"}, status=status.HTTP_404_NOT_FOUND)
            else:
                # 履歴全件取得（従来どおり）
                history_items = fetch_history_for_user(user_id, history_box_id)
                return Response(history_items, status=status.HTTP_200_OK)
        except Exception as e:
            print("🔥 get() で例外:", e)
            traceback.print_exc()
            return Response({"error": f"Failed to fetch history: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, *args, **kwargs):
        try:
            data = request.data
            print("データです", data)
            
            # 必須データのチェック
            required_fields = ['conversationId', 'question', 'answer']
            if not all(field in data for field in required_fields):
                return Response({'error': 'Missing required data'}, status=status.HTTP_400_BAD_REQUEST)
            
            created_item = create_new_conversation(
                tenant_id=data['tenantId'],
                user_id=data['userId'],
                conversation_id=data['conversationId'],
                question=data['question'],
                answer=data['answer'],
                historyBoxId=data['historyBoxId']
            )
            return Response(created_item, status=status.HTTP_201_CREATED)
        except Exception as e:
            print("🔥 Error in ChatHistoryView.post():", e)
            traceback.print_exc()
            return Response({"error": f"Failed to save chat: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class SavePromptView(APIView):
    """専用プロンプトの保存を処理するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            user_id = request.user.username
            data = request.data

            # 必須フィールドチェック（バリデーション）
            required_fields = ['tenantId', 'userId', 'title', 'description']
            for field in required_fields:
                if field not in data:
                    return Response({"error": f"Missing field: {field}"}, status=400)

            # save_prompt関数を呼び出す
            save_prompt(
                tenant_id=data['tenantId'],
                user_id=user_id,
                id=data.get('id'),  # id は新規時に無い場合もあるため get()
                title=data['title'],
                description=data['description']
            )

            return Response({"message": "保存しました！"}, status=200)

        except Exception as e:
            print("❌ SavePromptView error:", e)
            return Response({"error": str(e)}, status=500)
        
class GetPromptView(APIView):
    """ログインユーザーのプロンプト一覧を取得するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, **kwargs):
        try:
            user_id = request.user.username
            if not user_id:
                return Response(
                    {"error": "User ID not found"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            prompts = get_prompt(user_id)

            if not prompts:
                print("⚠️ プロンプトが見つかりませんでした")
                return Response([], status=status.HTTP_200_OK)

            print(f"✅ {len(prompts)} 件のプロンプトを取得")
            return Response(prompts, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ プロンプト取得中にエラー発生: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# --- フロントエンド設定用のビュー（認証不要） ---

def auth_setup(request):
    """フロントエンドにMSAL認証設定を返すビュー"""
    try:
        config_data = {
            "useLogin": True,
            "msalConfig": {
                "auth": {
                    "clientId": os.environ.get("VITE_APP_CLIENT_ID"),
                    "authority": f"https://login.microsoftonline.com/{os.environ.get('VITE_APP_TENANT_ID')}",
                    "redirectUri": os.environ.get("VITE_APP_REDIRECT_URI"),
                },
                "cache": {
                    "cacheLocation": "sessionStorage",
                }
            },
        }
        return JsonResponse(config_data)
    except Exception as e:
        return JsonResponse({'error': f'Configuration failed: {e}'}, status=500)

@ensure_csrf_cookie
def get_csrf_token(request):
    """クライアントにCSRFクッキーを送信するためのビュー"""
    return JsonResponse({"detail": "CSRF cookie set"})