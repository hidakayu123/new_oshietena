// React core
import React, { useMemo, useState } from "react";

// Third-party libraries
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

// Local application imports
import { ChatAppResponse } from "../../api";
import { AnswerIcon } from "./AnswerIcon";
import { parseAnswerToHtml } from "./AnswerParser";

// Styles
import styles from "./Answer.module.css";

interface Props {
    answer: ChatAppResponse;
    isStreaming: boolean;
}

export const Answer = ({
    answer,
    isStreaming,
}: Props) => {
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer, isStreaming), [answer]);
    const { t } = useTranslation();
    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        // Single replace to remove all HTML tags to remove the citations
        const textToCopy = sanitizedAnswerHtml.replace(/<a [^>]*><sup>\d+<\/sup><\/a>|<[^>]+>/g, "");

        navigator.clipboard
            .writeText(textToCopy)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(err => console.error("Failed to copy text: ", err));
    };

    return (
        <Stack className={`${styles.answerContainer}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: copied ? "CheckMark" : "Copy" }}
                            title={copied ? t("tooltips.copied") : t("tooltips.copy")}
                            ariaLabel={copied ? t("tooltips.copied") : t("tooltips.copy")}
                            onClick={handleCopy}
                        />
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <div className={styles.answerText}>
                    <ReactMarkdown children={sanitizedAnswerHtml} rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]} />
                </div>
            </Stack.Item>

            {!!parsedAnswer.citations.length && (
                <Stack.Item>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>{t("citationWithColon")}</span>
                        {parsedAnswer.citations.map((x, i) => {
                            return (
                                <a key={i} className={styles.citation} title={x}>
                                    {`${++i}. ${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}
        </Stack>
    );
};
