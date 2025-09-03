"""
URL configuration for new_oshietena project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from new_oshietena import views
from app.chat_count import ChatCountView
from django.urls import path
from .views import ChatView, ChatHistoryView, auth_setup, get_csrf_token
from .views import FrontendAppView

urlpatterns = [
    path("", FrontendAppView.as_view()),
    path('api/admin/', admin.site.urls),
    path('api/auth_setup/', auth_setup, name='auth_setup'),
    path('api/chat/', ChatView.as_view(), name='chat'),    
    path('api/checkcount/', ChatCountView.as_view(), name='checkcount'),
    path('api/startday/', ChatCountView.as_view(), name='get_startday'),
    path('api/history/', ChatHistoryView.as_view(), name='chat_history'),
    path('api/csrf-token', get_csrf_token, name='get_csrf_token'),
    path('api/history/<str:chat_id>/', ChatHistoryView.as_view(), name='get_single_chat'),
]
