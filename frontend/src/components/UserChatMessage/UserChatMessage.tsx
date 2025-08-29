import React from 'react';
import styles from "./UserChatMessage.module.css";

export const UserChatMessage = ({ message, id }: { message: string, id: string }) => {
    return (
        // 1. この外側のdivに container スタイルを適用して、右寄せを担当させます
        //    スクロール機能のためのidも、この一番外側の要素に付けます
        <div className={styles.container} id={`message-${id}`}>
            
            {/* 2. この内側のdivに message スタイルを適用して、吹き出しの見た目を担当させます */}
            <div className={styles.message}>
                {message}
            </div>

        </div>
    );
}