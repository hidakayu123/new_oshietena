import numpy as np
import requests
import tiktoken
import os
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from openai import AzureOpenAI

# Azure OpenAI Service の設定
AZURE_OPENAI_EMBEDDING_ENDPOINT = os.environ.get("AZURE_OPENAI_EMBEDDING_ENDPOINT")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-01")

# Azure AI Search Service の設定
SEARCH_CLIENT_ENDPOINT = os.environ.get("SEARCH_CLIENT_ENDPOINT")
AZURE_KEY_CREDENTIAL = os.environ.get("AZURE_KEY_CREDENTIAL")

# AI Search のインデックス名
TARGET_INDEX_COMPANYA = os.environ.get("TARGET_INDEX_COMPANYA")
TARGET_INDEX_COMPANYB = os.environ.get("TARGET_INDEX_COMPANYB")

GET_COMPANYA = {
    "vector_fields": "content_vector",
    "select_fields": ["content"],
}

GET_COMPANYB = {
    "index_name": TARGET_INDEX_COMPANYB,
    "vector_fields": "content_vector",
    "select_fields": ["title", "content"],
}

# --- 2. Pythonコード内で「設定辞書」を作成する ---

# AzureOpenAIクライアントを初期化するための設定辞書
openai_embedding_client_config = {
    "azure_endpoint": AZURE_OPENAI_EMBEDDING_ENDPOINT,
    "api_key": AZURE_OPENAI_KEY,
    "api_version": AZURE_OPENAI_API_VERSION,
}

def convert_string_to_vector(string):
    client = AzureOpenAI(**openai_embedding_client_config)
    tokenizer = tiktoken.get_encoding("cl100k_base")
    tokens = tokenizer.encode(string)
    split_tokens = [tokens[i : i + 8192] for i in range(0, len(tokens), 8192)]
    sum_string_vector = [
        client.embeddings.create(
            input=tokenizer.decode(chunk), model="text-embedding-3-large"
        )
        .data[0]
        .embedding
        for chunk in split_tokens
    ]
    if sum_string_vector:
        return np.mean(sum_string_vector, axis=0).tolist()
    else:
        return None


def process_vector_search(query, target_index, vector_fields, select_fields):
    search_client = SearchClient(
        endpoint=SEARCH_CLIENT_ENDPOINT,
        index_name=target_index,
        credential=AzureKeyCredential(AZURE_KEY_CREDENTIAL),
    )

    vector_query = VectorizedQuery(
        vector=convert_string_to_vector(query),
        k_nearest_neighbors=3,
        fields=vector_fields,
    )

    search_results = search_client.search(
        search_text="", vector_queries=[vector_query], select=select_fields, top=100
    )

    return list(search_results)

# 専用プロンプト用ベクトル検索
def process_target_index(messages, target_index):
    # if target_index == 'hidakayu':
        return process_vector_search(messages, target_index, **GET_COMPANYA)
    # elif target_index == TARGET_INDEX_COMPANYB:
    #     return process_vector_search(messages, **GET_COMPANYB)
    # else:
    #     print("Unknown target_index:", target_index)

# ベクトル検索結果を整える
def summarize_vector_results(results):
    # 結果がリスト形式（ドキュメントなど）なら内容を整形
    if isinstance(results, list):
        summary = "\n\n".join(
            f"- {item.get('title', '')}\n  {item.get('content', '')}" for item in results[:3]
        )
    else:
        summary = str(results)
    return summary