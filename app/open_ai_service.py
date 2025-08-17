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
    # for chunk in response:
    #     print(chunk)
    
    print("ストリーム終了")
    return response


# def stream_chatbot_response(messages, response):
#     print("これ来てる？")
#     # ストリーミングされる各データチャンクを処理
#     for chunk in response:
#         print("ループ内で受信したチャンク:", chunk)
#         # チャンクに有効なデータがあるかチェック
#         if not (chunk.choices and chunk.choices[0].delta):
#             continue

#         delta = chunk.choices[0].delta
#         finish_reason = chunk.choices[0].finish_reason

#         # 1. ストリームが終了した場合
#         if finish_reason:
#             print("これが最後のチャンクです:", chunk) 
#             # 最終的なメッセージリストを送信し、終了イベントを通知
#             yield f"data: {json.dumps({'messages': messages}, ensure_ascii=False)}\n\n"
#             yield "event: end\n\n"
#             return  # 関数の実行をここで終了

#         # 2. 通常のテキストコンテンツがある場合
#         if delta.content:
#             content = delta.content
#             # フロントエンドにテキストデータをストリーミング
#             data = {"content": content}
#             yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

#             # あなたのPythonのストリーミング用関数

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