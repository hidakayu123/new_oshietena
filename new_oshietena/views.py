from django.shortcuts import render
import json

from django.http import JsonResponse, StreamingHttpResponse
from app.ai_search_service import (process_target_index, summarize_vector_results)
from app.open_ai_service import (handle_chatbot_response, stream_chatbot_response)
from new_oshietena.const import (CONTENT_FILTER_ERROR_MESSAGE, OTHERS_ERROR_MESSAGE)
from django.contrib.auth.decorators import login_required
# def home(request):
#     return render(request, 'chat.html')

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