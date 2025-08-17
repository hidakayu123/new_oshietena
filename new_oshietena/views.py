import os
import json
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

# 認証クラスとサービス関数をインポート
from .authentication import AzureADJWTAuthentication
from app.open_ai_service import handle_chatbot_response, stream_chatbot_response
from app.open_ai_service import handle_chatbot_response, stream_chatbot_response
from app.ai_search_service import process_target_index, summarize_vector_results
from app.save_chat import create_new_conversation

# --- APIビュー ---

class ChatView(APIView):
    """チャットのストリーミング応答を処理するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            messages = request.data.get("messages", [])
            target_index = request.auth.get('oid')
            if not messages:
                return Response({"error": "messages field is required."}, status=status.HTTP_400_BAD_REQUEST)

            user_question = ""
            if isinstance(messages, list): # messagesがリストであることを確認
                for message in messages:
                    if message.get("role") == "user":
                        user_question = message.get("content")
                        break # ユーザーの質問を見つけたらループを抜ける

            if target_index:
                anser = process_target_index(user_question, target_index)
                print(anser)
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
            return Response({"error": f"Chat processing error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ChatHistoryView(APIView):
    """チャット履歴の取得と保存を処理するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            tenant_id = request.user.username.split('@')[1] if '@' in request.user.username else None
            history_items = fetch_history_for_user(tenant_id)
            return Response(history_items, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to fetch history: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, *args, **kwargs):
        try:
            data = request.data
            user_id = request.user.username
            tenant_id = user_id.split('@')[1] if '@' in user_id else None
            
            # 必須データのチェック
            required_fields = ['conversationId', 'question', 'answer']
            if not all(field in data for field in required_fields):
                return Response({'error': 'Missing required data'}, status=status.HTTP_400_BAD_REQUEST)
            
            created_item = create_new_conversation(
                tenant_id=tenant_id,
                user_id=user_id,
                conversation_id=data['conversationId'],
                question=data['question'],
                answer=data['answer']
            )
            return Response(created_item, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Failed to save chat: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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