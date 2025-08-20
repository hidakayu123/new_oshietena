import concurrent.futures
import json
import os
from openai import AzureOpenAI
from django.http import JsonResponse
import httpx


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
url = "https://oshietenaapimanagement.azure-api.net/oshietena-2/deployments/gpt-4.1/chat/completions?api-version=2025-01-01-preview"
headers = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
    "api-key": AZURE_OPENAI_KEY,
}

def handle_chatbot_response(messages):
    
    kwargs = {
        "messages": messages,
        "model": deployment,
        "stream": True,
        "temperature": 0,
    }

    # response = httpx.post(url, headers=headers, json=kwargs, timeout=30)
    # response = client.chat.completions.create(**kwargs)
    # print(response)
    # return response

    print("これ来てるの？")
    try:
        # 1. APIを呼び出す
        response = httpx.post(url, headers=headers, json=kwargs, timeout=30)
        print("！！！！！レスポンス", response)

        # 2. すぐにステータスを確認し、エラーなら例外を発生させる
        #    この行で4xxや5xxエラーが検知され、exceptブロックにジャンプする
        response.raise_for_status()

        # 3. 例外が発生しなかった場合（=成功した場合）のみ、以下の処理に進む
        print("これは？") 
        return response

    # httpxのHTTPステータスエラーを具体的にキャッチする
    except httpx.HTTPStatusError as e:
        print(f"★★ HTTP Status Error: {e.response.status_code} - {e.response.text} ★★")
        return JsonResponse(
            {"error": f"APIからエラー応答がありました: {e.response.status_code}", "details": e.response.json()},
            status=e.response.status_code
        )

    # タイムアウトや接続エラーなど、その他の例外をキャッチする
    except Exception as e:
        print(f"★★ API Error Log: {e} ★★")
        return JsonResponse({"error": "申し訳ありません。サーバーでエラーが発生しました。"}, status=500)
    







def stream_chatbot_response(messages, response):
    print("【Python】1. stream_chatbot_response 関数が開始されました") # ★追加
    try:
        chunk_count = 0
        for chunk in response:
            chunk_count += 1
            print(f"【Python】2. LLMからのチャンクを受信しました ({chunk_count}回目)") # ★追加

            if not (chunk.choices and chunk.choices[0].delta):
                print("【Python】警告: 無効なチャンクです。スキップします。") # ★追加
                continue

            delta = chunk.choices[0].delta
            
            if delta.content:
                print(f"【Python】3. contentをyieldします: '{delta.content}'") # ★追加
                data = {"content": delta.content}
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            
            # (finish_reasonの処理などは省略)

        print(f"【Python】4. ループが正常に終了しました。総チャンク数: {chunk_count}") # ★追加

    except Exception as e:
        print(f"【Python】エラー: ストリーム処理中に例外が発生しました: {e}") # ★追加
        # エラー発生をフロントに通知するのも有効
        yield f'data: {json.dumps({"error": "An error occurred on the server."})}\n\n'