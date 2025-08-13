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
from app.chat_count import chatcount

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth_setup', views.auth_setup, name='auth_setup'),
    path('chat', views.chatbot, name='chat'),        
    path("checkcount", chatcount, name="checkcount"),
    path("save/history", views.savechat, name="save_history"),
    path('get/history/', views.get_chat_history, name='get_history'),
    # path('config', views.get_config, name='config'),
    # path('chat/stream', views.stream_chat_view, name='stream_chat'),
]
