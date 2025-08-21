import concurrent.futures
import json
import os
from openai import AzureOpenAI
from django.http import JsonResponse

DEPLOYMENT = os.environ.get("DEPLOYMENT")
# Azure OpenAI Service の設定
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION")
APIM_SUBSCRIPTION_KEY = os.environ.get("APIM_SUBSCRIPTION_KEY")

# AzureOpenAIクライアントを初期化するための設定辞書
openai_client_config = {
    "azure_endpoint": AZURE_OPENAI_ENDPOINT,
    "api_key": AZURE_OPENAI_KEY,
    "api_version": AZURE_OPENAI_API_VERSION,
    "default_headers": {"Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY},
}
client = AzureOpenAI(**openai_client_config)
deployment = DEPLOYMENT

def handle_chatbot_response(messages):
    
    kwargs = {
        "messages": messages,
        "model": deployment,
        "stream": False,
        # "stream": True,   ←ストリーミング回答用
        "temperature": 0,
    }
    response = client.chat.completions.create(**kwargs)
    return response
#===============================================================================================
# 以下ストリーミング回答用
# def stream_chatbot_response(messages, response):
#     print("【Python】1. stream_chatbot_response 関数が開始されました") # ★追加
#     try:
#         chunk_count = 0
#         for chunk in response:
#             chunk_count += 1
#             print(f"【Python】2. LLMからのチャンクを受信しました ({chunk_count}回目)") # ★追加

#             if not (chunk.choices and chunk.choices[0].delta):
#                 print("【Python】警告: 無効なチャンクです。スキップします。") # ★追加
#                 continue

#             delta = chunk.choices[0].delta
            
#             if delta.content:
#                 print(f"【Python】3. contentをyieldします: '{delta.content}'") # ★追加
#                 data = {"content": delta.content}
#                 yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            
#             # (finish_reasonの処理などは省略)

#         print(f"【Python】4. ループが正常に終了しました。総チャンク数: {chunk_count}") # ★追加

#     except Exception as e:
#         print(f"【Python】エラー: ストリーム処理中に例外が発生しました: {e}") # ★追加
#         # エラー発生をフロントに通知するのも有効
#         yield f'data: {json.dumps({"error": "An error occurred on the server."})}\n\n'
#===============================================================================================