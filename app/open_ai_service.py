import concurrent.futures
import json
import os
from openai import AzureOpenAI

DEPLOYMENT = os.environ.get("DEPLOYMENT")
# Azure OpenAI Service の設定
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-01")

# AzureOpenAIクライアントを初期化するための設定辞書
openai_client_config = {
    "azure_endpoint": AZURE_OPENAI_ENDPOINT,
    "api_key": AZURE_OPENAI_KEY,
    "api_version": AZURE_OPENAI_API_VERSION,
}

client = AzureOpenAI(**openai_client_config)
deployment = DEPLOYMENT

def handle_chatbot_response(messages):
    kwargs = {
        "messages": messages,
        "model": deployment,
        "stream": True,
        "temperature": 0,
    }

    response = client.chat.completions.create(**kwargs)
    return response


def stream_chatbot_response(messages, response):
    # ストリーミングされる各データチャンクを処理
    for chunk in response:
        # チャンクに有効なデータがあるかチェック
        if not (chunk.choices and chunk.choices[0].delta):
            continue

        delta = chunk.choices[0].delta
        finish_reason = chunk.choices[0].finish_reason

        # 1. ストリームが終了した場合
        if finish_reason:
            # 最終的なメッセージリストを送信し、終了イベントを通知
            yield f"data: {json.dumps({'messages': messages}, ensure_ascii=False)}\n\n"
            yield "event: end\n\n"
            return  # 関数の実行をここで終了

        # 2. 通常のテキストコンテンツがある場合
        if delta.content:
            content = delta.content
            # フロントエンドにテキストデータをストリーミング
            data = {"content": content}
            yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"