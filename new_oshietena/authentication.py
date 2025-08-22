import os
import jwt
from jwt import PyJWKClient
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User # DjangoのUserモデルを利用

# --- Azure AD 認証のための設定 ---
SYSTENA_TENANT_ID = os.environ.get("VITE_APP_TENANT_ID")
CLIENT_ID = os.environ.get("VITE_APP_CLIENT_ID")
JWKS_URL = f"https://login.microsoftonline.com/{SYSTENA_TENANT_ID}/discovery/v2.0/keys"
AUDIENCE = f"api://{CLIENT_ID}"
JWK_CLIENT = PyJWKClient(JWKS_URL, cache_keys=True)

class AzureADJWTAuthentication(BaseAuthentication):
    """
    Azure ADが発行したJWTトークンを検証するDRF認証クラス。
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None # 認証情報がない場合は、次の認証クラスに任せる

        try:
            token = auth_header.split(' ')[1]
            signing_key = JWK_CLIENT.get_signing_key_from_jwt(token).key
            
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=CLIENT_ID,
                issuer=f"https://sts.windows.net/{SYSTENA_TENANT_ID}/"
            )

            # トークンからユーザー情報を取得
            username = payload.get('preferred_username') or payload.get('upn')
            if not username:
                raise AuthenticationFailed('Token does not contain a username.')
            
            # DjangoのUserモデルと連携（存在しない場合は作成）
            user, created = User.objects.get_or_create(username=username)

            # 検証に成功した場合、(user, auth) タプルを返す
            return (user, payload)

        except jwt.PyJWTError as e:
            raise AuthenticationFailed(f'Token is invalid: {str(e)}')
        except Exception as e:
            raise AuthenticationFailed(f'An unexpected authentication error occurred: {str(e)}')