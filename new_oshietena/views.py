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
from app.get_chat_history import fetch_history_for_user, fetch_single_chat_by_id

import traceback

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
                content = response.choices[0].message.content
                return JsonResponse({
                    "message": {
                        "content": content,
                        "role": "assistant"
                    },
                    "context": {
                        "data_points": [],
                        "followup_questions": [],
                        "thoughts": []
                    },
                    "session_state": "",
                    "delta": "" 
                })
        except Exception as e:
            print(f"❌ エラー: {e}")
            return JsonResponse({"error": "内部エラー"}, status=500)
            #     if response:
            #         print("✅ 応答:", response)
            #     else:
            #         print("❌ 応答の取得に失敗しました")
            # return StreamingHttpResponse(
            #     stream_chatbot_response(messages, response.json()),
            #     content_type="text/event-stream",
            # )
        except Exception as e:
            return Response({"error": f"Chat processing error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ChatHistoryView(APIView):
    """チャット履歴の取得と保存を処理するビュー"""
    authentication_classes = [AzureADJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            user_id = request.user.username
            chat_id = kwargs.get('chat_id')  # ← ここでURLのidパラメータを取得
            print(f"🧩 tenant_id: {user_id}, chat_id: {chat_id}")


            if chat_id:
                # 個別チャット取得
                item = fetch_single_chat_by_id(user_id, chat_id)
                if item:
                    # if "chatHistory" not in item:
                    #     item["chatHistory"] = [{
                    #         "user": item.get("question", ""),
                    #         "gpt": item.get("answer", "")
                    #     }]
                    #     print("✅ chatHistory を追加:", item["chatHistory"])
                    return Response(item, status=status.HTTP_200_OK)
                else:
                    print("❌ チャット取得失敗: item is None")
                    return Response({"error": "指定されたチャットは見つかりませんでした"}, status=status.HTTP_404_NOT_FOUND)
            else:
                # 履歴全件取得（従来どおり）
                history_items = fetch_history_for_user(user_id)
                return Response(history_items, status=status.HTTP_200_OK)
        except Exception as e:
            print("🔥 get() で例外:", e)
            traceback.print_exc()
            return Response({"error": f"Failed to fetch history: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, *args, **kwargs):
        try:
            print("🔥 POST /api/history/ called")
            print("request.user:", request.user)
            print("request.user.username:", getattr(request.user, "username", "N/A"))
            print("request.data:", request.data)
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
            print("🔥 Error in ChatHistoryView.post():", e)
            traceback.print_exc()
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