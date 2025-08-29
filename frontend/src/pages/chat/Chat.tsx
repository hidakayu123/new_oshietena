import React from 'react';
//import { useAppAuth } from '../../AuthHandler'; 
import { useRef, useState, useEffect, useContext, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { Panel, DefaultButton } from "@fluentui/react";
import readNDJSONStream from "ndjson-readablestream";

import appLogo from "../../assets/applogo.svg";
import styles from "./Chat.module.css";
import { saveConversationToDb } from "../../api";

import {
    chatApi,
    // configApi,
    RetrievalMode,
    ChatAppResponse,
    ChatAppResponseOrError,
    ChatAppRequest,
    ResponseMessage,
    VectorFields,
    GPT4VInput,
    SpeechConfig
} from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { HistoryPanel } from "../../components/HistoryPanel";
import { HistoryProviderOptions, useHistoryManager } from "../../components/HistoryProviders";
import { HistoryButton } from "../../components/HistoryButton";
import { SettingsButton } from "../../components/SettingsButton";
import { ClearChatButton } from "../../components/ClearChatButton";
import { UploadFile } from "../../components/UploadFile";
import { useLogin, getToken, requireAccessControl } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { TokenClaimsDisplay } from "../../components/TokenClaimsDisplay";
import { LoginContext } from "../../loginContext";
import { LanguagePicker } from "../../i18n/LanguagePicker";
import { Settings } from "../../components/Settings/Settings";
import Sidebarmenu from '../../../../static/menu.js';
import { msalInstance  } from '../../authConfig'; // 以前デバッグしたトークン取得関数   
import { useAuthToken } from "../../AuthContext";
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from "react-router-dom";
import { ConversationTurn, InitialAnswerRaw } from "../../api";
import  SimpleModal   from "./SimpleModal";

interface ChatProps {
  initialAnswers?: InitialAnswerRaw[];
  targetId?: string | null;
  historyBoxId?: string | null;
}
const Chat = ({ initialAnswers, targetId ,historyBoxId }: ChatProps) => {
    const [localHistoryBoxId, setLocalHistoryBoxId] = useState<string | null>(historyBoxId || null);
    useEffect(() => {
        if (!localHistoryBoxId) {
        // 💡 props で渡されてなかった場合に uuid を生成
        const newId = uuidv4();
        setLocalHistoryBoxId(newId);
        }
    }, [localHistoryBoxId]);
    const lastQuestionRef = useRef<string>("");
    const [answers, setAnswers] = useState<ConversationTurn[]>(() => {
            // もし initialAnswers (履歴データ) が渡されていたら...
            if (initialAnswers && initialAnswers.length > 0) {
                // ...それを <Chat> コンポーネントが内部で使う形式 ([string, ChatAppResponse][]) に変換する
                const transformedHistory = initialAnswers.map(item => {
                    const answerObject: ChatAppResponse = {
                        message: { content: item.answer, role: 'assistant' },
                        context: { data_points: [], followup_questions: [], thoughts: [] },
                        session_state: null,
                        delta: null
                    };
                    return {
                        id: item.id || uuidv4(), // initialAnswersの各要素に .id が必要
                        question: item.question,
                        answer: answerObject
                    };
                });
                lastQuestionRef.current = "履歴取得";
                return transformedHistory;
            }
            
            // 履歴データがなければ、空の配列で初期化する
            return [];
        });
        console.info(answers)
    
    const [scrollToId, setScrollToId] = useState<string | null>(null);
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [temperature, setTemperature] = useState<number>(0.3);
    const [seed, setSeed] = useState<number | null>(null);
    const [minimumRerankerScore, setMinimumRerankerScore] = useState<number>(0);
    const [minimumSearchScore, setMinimumSearchScore] = useState<number>(0);
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [maxSubqueryCount, setMaxSubqueryCount] = useState<number>(10);
    const [resultsMergeStrategy, setResultsMergeStrategy] = useState<string>("interleaved");
    const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>(RetrievalMode.Vectors);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useQueryRewriting, setUseQueryRewriting] = useState<boolean>(false);
    const [reasoningEffort, setReasoningEffort] = useState<string>("");
    const [streamingEnabled, setStreamingEnabled] = useState<boolean>(true);
    const [shouldStream, setShouldStream] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [includeCategory, setIncludeCategory] = useState<string>("");
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const [vectorFields, setVectorFields] = useState<VectorFields>(VectorFields.TextAndImageEmbeddings);
    const [useOidSecurityFilter, setUseOidSecurityFilter] = useState<boolean>(false);
    const [useGroupsSecurityFilter, setUseGroupsSecurityFilter] = useState<boolean>(false);
    const [gpt4vInput, setGPT4VInput] = useState<GPT4VInput>(GPT4VInput.TextAndImages);
    const [useGPT4V, setUseGPT4V] = useState<boolean>(false);
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [speechUrls, setSpeechUrls] = useState<(string | null)[]>([]);
    const [showGPT4VOptions, setShowGPT4VOptions] = useState<boolean>(false);
    const [showSemanticRankerOption, setShowSemanticRankerOption] = useState<boolean>(false);
    const [showQueryRewritingOption, setShowQueryRewritingOption] = useState<boolean>(false);
    const [showReasoningEffortOption, setShowReasoningEffortOption] = useState<boolean>(false);
    const [showVectorOption, setShowVectorOption] = useState<boolean>(false);
    const [showUserUpload, setShowUserUpload] = useState<boolean>(false);
    const [showLanguagePicker, setshowLanguagePicker] = useState<boolean>(false);
    const [showSpeechInput, setShowSpeechInput] = useState<boolean>(false);
    const [showSpeechOutputBrowser, setShowSpeechOutputBrowser] = useState<boolean>(false);
    const [showSpeechOutputAzure, setShowSpeechOutputAzure] = useState<boolean>(false);
    const [showChatHistoryBrowser, setShowChatHistoryBrowser] = useState<boolean>(false);
    const [showChatHistoryCosmos, setShowChatHistoryCosmos] = useState<boolean>(false);
    const [showAgenticRetrievalOption, setShowAgenticRetrievalOption] = useState<boolean>(false);
    const [useAgenticRetrieval, setUseAgenticRetrieval] = useState<boolean>(false);
    const navigate = useNavigate();
    const audio = useRef(new Audio()).current;
    const [isPlaying, setIsPlaying] = useState(false);
    const { instance } = useMsal();
    // state定義（親コンポーネント内）
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: ""});

    // モーダルを閉じる関数
    const hideModal = () => setModalVisible(false);
    const speechConfig: SpeechConfig = {
        speechUrls,
        setSpeechUrls,
        audio,
        isPlaying,
        setIsPlaying
    };
    const client = useLogin ? useMsal().instance : undefined;
    const { loggedIn } = useContext(LoginContext);
    const historyProvider: HistoryProviderOptions = (() => {
        if (useLogin && showChatHistoryCosmos) return HistoryProviderOptions.CosmosDB;
        if (showChatHistoryBrowser) return HistoryProviderOptions.IndexedDB;
        return HistoryProviderOptions.None;
    })();
    const historyManager = useHistoryManager(historyProvider);
    const { token } = useAuthToken();
    
    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        // 1. UI Stateの準備
        // 画面のローディング状態などをリセット
        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        // 最初にユーザーの質問と、空の回答欄をUIに追加する
        // これにより、ユーザーは即座にフィードバックを得られる
        const initialResponse: ChatAppResponse = {
            message: { content: "", role: "assistant" },
            delta: null,
            context: { data_points: [], followup_questions: [], thoughts: [] },
            session_state: {}
        };
        // ★Stateを更新する際は、必ず更新用の関数 (setAnswers) を使う
        //setAnswers(prevAnswers => [...prevAnswers, [question, initialResponse]]);
        const newTurn: ConversationTurn = {
            id: uuidv4(), // 新しいIDを生成
            question: question,
            answer: initialResponse
        };
        setAnswers(prevAnswers => [...prevAnswers, newTurn]);

        try {
            // 2. APIリクエストの構築
            // 認証トークンの取得
            const token = client ? await getToken(client) : undefined;
            const account = instance.getActiveAccount();
            if (!account) {
                throw new Error("No active account");
            }

            // 現在の会話履歴からAPI用のメッセージ配列を作成
            // 注意：setAnswersは非同期のため、ここでは更新前のanswersを使う
            const history = answers.flatMap(turn => [{ content: turn.question, role: "user" }, { content: turn.answer.message.content, role: "assistant" }]);

            const request: ChatAppRequest = {
                messages: [...history, { content: question, role: "user" }],
                context: {
                    overrides: {
                        prompt_template: promptTemplate || undefined,
                        include_category: includeCategory || undefined,
                        exclude_category: excludeCategory || undefined,
                        top: retrieveCount,
                        max_subqueries: maxSubqueryCount,
                        results_merge_strategy: resultsMergeStrategy,
                        temperature: temperature,
                        minimum_reranker_score: minimumRerankerScore,
                        minimum_search_score: minimumSearchScore,
                        retrieval_mode: retrievalMode,
                        semantic_ranker: useSemanticRanker,
                        semantic_captions: useSemanticCaptions,
                        query_rewriting: useQueryRewriting,
                        reasoning_effort: reasoningEffort,
                        suggest_followup_questions: useSuggestFollowupQuestions,
                        use_oid_security_filter: useOidSecurityFilter,
                        use_groups_security_filter: useGroupsSecurityFilter,
                        vector_fields: vectorFields,
                        use_gpt4v: useGPT4V,
                        gpt4v_input: gpt4vInput,
                        language: i18n.language,
                        use_agentic_retrieval: useAgenticRetrieval,
                        ...(seed !== null ? { seed: seed } : {})
                    }
                },
                session_state: answers.length ? answers[answers.length - 1].answer.session_state : null
            };

            // --- DB保存用の共通関数を定義 ---
            const saveConversation = async (question: string, answer: ChatAppResponse) => {
                // session_state がなければ保存しない
                // if (!answer.session_state) return;

                try {
                    console.log("DBへの会話保存処理を開始します...");
                    const dbToken = client ? await getToken(client) : undefined;
                    const userId = client?.getActiveAccount()?.username || "unknown-user";
                    const activeAccount = client?.getActiveAccount();
                    const tenantId = activeAccount?.tenantId;
                    const conversationId = uuidv4(); 

                    await saveConversationToDb({
                        userId: userId,
                        tenantId: tenantId,
                        conversationId: conversationId,
                        question: question,
                        answer: answer,
                        historyBoxId: localHistoryBoxId,
                    }, dbToken ?? null);

                    console.log("会話が正常にDBへ保存されました。");
                } catch (error) {
                    console.error("DBへの会話保存中にエラーが発生しました:", error);
                }
            };

            // 3. API呼び出しとレスポンス処理
                const response = await chatApi(request, token);

                if (!response.ok) {
                        const errorBody = await response.json();
                        const error = new Error();
                        (error as any).code = errorBody.error || "unknown_error";
                        throw error;
                    }

            let finalAnswer: ChatAppResponse;

// ===============================================================================================
//  以下ストリーミング回答用
            if (shouldStream) {
                // --- ストリーミング処理 ---
                setIsStreaming(true);
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let partialData = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    partialData += decoder.decode(value, { stream: true });
                    const dataBlocks = partialData.split("\n\n");

                    for (let i = 0; i < dataBlocks.length - 1; i++) {
                        const block = dataBlocks[i];
                        if (block.startsWith("data: ")) {
                            const jsonString = block.substring(6);
                            try {
                                const event = JSON.parse(jsonString);
                                setAnswers(prevAnswers => {
                                    const newAnswers = [...prevAnswers];
                                    const lastAnswer = newAnswers[newAnswers.length - 1].answer;
                                    if (event.content) {
                                        lastAnswer.message.content += event.content;
                                    }
                                    if (event.context) {
                                        lastAnswer.context = { ...lastAnswer.context, ...event.context };
                                    }
                                    if (event.session_state) {
                                        lastAnswer.session_state = { ...(lastAnswer.session_state || {}), ...event.session_state };
                                    }
                                    return newAnswers;
                                });
                            } catch (e) {
                                console.error("Failed to parse stream data:", jsonString, e);
                            }
                        }
                    }
                    partialData = dataBlocks[dataBlocks.length - 1];
                }
                finalAnswer =  { ...initialResponse };
            } else {
// ===============================================================================================

                // --- 非ストリーミング処理 ---
                const parsedResponse = await response.json();
                if (parsedResponse.error) {
                    throw new Error(parsedResponse.error);
                }
                // 最後の回答を、受信した完全なレスポンスで置き換える
                setAnswers(prevAnswers => {
                    const newAnswers = [...prevAnswers];
                    newAnswers[newAnswers.length - 1].answer = parsedResponse;
                    return newAnswers;
                });
                finalAnswer = parsedResponse;
                if (typeof parsedResponse.session_state === "string" && parsedResponse.session_state !== "") {
                const token = client ? await getToken(client) : undefined;
                const historyForManager = answers.map(turn => [turn.question, turn.answer] as [string, ChatAppResponse]);
                historyManager.addItem(parsedResponse.session_state, [...historyForManager, [question, parsedResponse]], token);
                };
// ===============================================================================================
//  以下ストリーミング回答用
            }
// ===============================================================================================

            await saveConversation(question, finalAnswer);
        } catch (e: any) {
            if (e.code === "rate_limit") {
                setModalContent({
                    title: "利用上限に達しました",
                });
                setModalVisible(true);
                setAnswers(prevAnswers => {
                    const newAnswers = [...prevAnswers];
                    newAnswers[newAnswers.length - 1].answer.message.content = "利用上限に達しました";
                    return newAnswers;})
            } else {
                console.error("チャットAPIエラー:", e);
            
                setError(e);
                // エラーが発生した場合、最後の回答欄にエラーメッセージを表示する
                setAnswers(prevAnswers => {
                    const newAnswers = [...prevAnswers];
                    newAnswers[newAnswers.length - 1].answer.message.content = "エラーが発生しました: " + e.message;
                    return newAnswers;
                });
            }
        } finally {
            // 5. 最終処理
            setIsLoading(false);
            setIsStreaming(false);
        }
    };
    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);
        setSpeechUrls([]);
        // setStreamedAnswers([]);
        setIsLoading(false);
        setIsStreaming(false);
        navigate("/");
    };

    useLayoutEffect(() => {
        console.log("【3. Chat 検証】スクロールターゲットを探すuseEffectが実行されました。targetId:", targetId);

        // targetQuestion があり、answersがセットされた後に実行
        if (targetId && answers.length > 0) {
            const targetTurn = answers.find(turn => turn.id === targetId);
            if (targetTurn) {
                console.log("【3. Chat 検証】ターゲットが見つかりました！ID:", targetTurn.id);
                setScrollToId(targetTurn.id);
            } else {
                console.log("【3. Chat 検証】ターゲットが見つかりませんでした。");
            }
        }
    }, [targetId]); // answersとtargetQuestionが変わった時に実行


    useLayoutEffect(() => {
        if (scrollToId) {
            const element = document.getElementById(`message-${scrollToId}`);
            if (element) {
                element.scrollIntoView({ behavior: "auto", block: "start" });
            }
            setScrollToId(null); // 処理後にリセット
        }
    }, [answers, scrollToId]);

    // const handleSettingsChange = (field: string, value: any) => {
    //     switch (field) {
    //         case "promptTemplate":
    //             setPromptTemplate(value);
    //             break;
    //         case "temperature":
    //             setTemperature(value);
    //             break;
    //         case "seed":
    //             setSeed(value);
    //             break;
    //         case "minimumRerankerScore":
    //             setMinimumRerankerScore(value);
    //             break;
    //         case "minimumSearchScore":
    //             setMinimumSearchScore(value);
    //             break;
    //         case "retrieveCount":
    //             setRetrieveCount(value);
    //             break;
    //         case "maxSubqueryCount":
    //             setMaxSubqueryCount(value);
    //             break;
    //         case "resultsMergeStrategy":
    //             setResultsMergeStrategy(value);
    //             break;
    //         case "useSemanticRanker":
    //             setUseSemanticRanker(value);
    //             break;
    //         case "useQueryRewriting":
    //             setUseQueryRewriting(value);
    //             break;
    //         case "reasoningEffort":
    //             setReasoningEffort(value);
    //             break;
    //         case "useSemanticCaptions":
    //             setUseSemanticCaptions(value);
    //             break;
    //         case "excludeCategory":
    //             setExcludeCategory(value);
    //             break;
    //         case "includeCategory":
    //             setIncludeCategory(value);
    //             break;
    //         case "useOidSecurityFilter":
    //             setUseOidSecurityFilter(value);
    //             break;
    //         case "useGroupsSecurityFilter":
    //             setUseGroupsSecurityFilter(value);
    //             break;
    //         case "shouldStream":
    //             setShouldStream(value);
    //             break;
    //         case "useSuggestFollowupQuestions":
    //             setUseSuggestFollowupQuestions(value);
    //             break;
    //         case "useGPT4V":
    //             setUseGPT4V(value);
    //             break;
    //         case "gpt4vInput":
    //             setGPT4VInput(value);
    //             break;
    //         case "vectorFields":
    //             setVectorFields(value);
    //             break;
    //         case "retrievalMode":
    //             setRetrievalMode(value);
    //             break;
    //         case "useAgenticRetrieval":
    //             setUseAgenticRetrieval(value);
    //     }
    // };

    // const onExampleClicked = (example: string) => {
    //     makeApiRequest(example);
    // };
    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }

        setSelectedAnswer(index);
    };
    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setSelectedAnswer(index);
    };
    const { t, i18n } = useTranslation();

    // useEffect(() => {
    //     chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
    // }, [answers]); 

    return (
        <div className={styles.container}>
            {/* Setting the page title using react-helmet-async */}
            <Helmet>
                <title>{t("pageTitle")}</title>
            </Helmet>
            <div className={styles.commandsSplitContainer}>
                <div className={styles.commandsContainer}>
                    {/* {((useLogin && showChatHistoryCosmos) || showChatHistoryBrowser) && (
                        <HistoryButton className={styles.commandButton} onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)} />
                    )} */}
                </div>
                <div className={styles.commandsContainer}>
                    <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
                    {showUserUpload && <UploadFile className={styles.commandButton} disabled={!loggedIn} />}
                    {/* <SettingsButton className={styles.commandButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} /> */}
                </div>
            </div>
            <Sidebarmenu/>
            <div className={styles.chatRoot} style={{ marginLeft: isHistoryPanelOpen ? "300px" : "0" }}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <img src={appLogo} alt="App logo" width="120" height="120" />

                            <h1 className={styles.chatEmptyStateTitle}>{t("chatEmptyStateTitle")}</h1>
                            {/* <h2 className={styles.chatEmptyStateSubtitle}>{t("chatEmptyStateSubtitle")}</h2> */}
                            {showLanguagePicker && <LanguagePicker onLanguageChange={newLang => i18n.changeLanguage(newLang)} />}

                            {/* <ExampleList onExampleClicked={onExampleClicked} useGPT4V={useGPT4V} /> */}
                        </div>
                    ) : (
                        <div className={styles.chatMessageStream}>
                            {answers.map((turn, index) => {
                                const isLastAnswer = index === answers.length - 1;

                                return (
                                    <div key={turn.id}>
                                        <UserChatMessage message={turn.question} id={turn.id} />
                                        <div className={styles.chatMessageGpt}>
                                            {/* 最後の回答欄の表示を、Stateに応じて切り替える */}
                                            {isLastAnswer && error ? (
                                                <div className={styles.chatMessageGptMinWidth}>
                                                    <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                                </div>
                                            ) : isLastAnswer && isLoading ? (
                                                <div className={styles.chatMessageGptMinWidth}>
                                                    <AnswerLoading />
                                                </div>
                                            ) : (
                                                <Answer
                                                    isStreaming={isStreaming && isLastAnswer} // ストリーミング中も正しく表示
                                                    key={index}
                                                    answer={turn.answer}
                                                    index={index}
                                                    speechConfig={speechConfig}
                                                    isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                    onCitationClicked={c => onShowCitation(c, index)}
                                                    onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                    onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                    onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                    showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                                    showSpeechOutputAzure={showSpeechOutputAzure}
                                                    showSpeechOutputBrowser={showSpeechOutputBrowser}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatMessageStreamEnd} />
                        </div>
                    )}
                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder={t("defaultExamples.placeholder")}
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                            showSpeechInput={showSpeechInput}
                            chatMessageStreamEnd={chatMessageStreamEnd}
                        />
                    </div>
                </div>
                {/* {answers.length > 0 && activeAnalysisPanelTab && (
                    <AnalysisPanel
                        className={styles.chatAnalysisPanel}
                        activeCitation={activeCitation}
                        onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                        citationHeight="810px"
                        answer={answers[selectedAnswer].answer}
                        activeTab={activeAnalysisPanelTab}
                    />
                )}
                {((useLogin && showChatHistoryCosmos) || showChatHistoryBrowser) && (
                    <HistoryPanel
                        provider={historyProvider}
                        isOpen={isHistoryPanelOpen}
                        notify={!isStreaming && !isLoading}
                        onClose={() => setIsHistoryPanelOpen(false)}
                        onChatSelected={data => { // "data" を受け取る

                            // ★★★★★★★★★★★★★★★★★★★★★★★★★
                            // ★ data.conversation に対して .map を使います ★
                            // ★★★★★★★★★★★★★★★★★★★★★★★★★
                            const transformedHistory = data.conversation.map(turn => {
                                // ★ このカッコの中で "turn" が使えます ★
                                // turn は [質問文字列, 回答オブジェクト] という配列です
                                const question = turn[0];
                                const answer = turn[1];
                                return {
                                    id: uuidv4(), // 古いデータにはIDがないため、ここで新しいIDを生成
                                    question: question,
                                    answer: answer
                                };
                            }); // ★ ここで .map の処理は終わりです ★

                            const firstMessageId = transformedHistory.length > 0 ? transformedHistory[0].id : null;

                            // ★ .map が終わった後で、stateを更新します ★
                            setAnswers(transformedHistory);
                            setScrollToId(data.targetId);
                            lastQuestionRef.current = transformedHistory.length > 0 ? transformedHistory[transformedHistory.length - 1].question : "";
                        }}
                    />
                )}
                <Panel
                    headerText={t("labels.headerText")}
                    isOpen={isConfigPanelOpen}
                    isBlocking={false}
                    onDismiss={() => setIsConfigPanelOpen(false)}
                    closeButtonAriaLabel={t("labels.closeButton")}
                    onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>{t("labels.closeButton")}</DefaultButton>}
                    isFooterAtBottom={true}
                >
                    <Settings
                        promptTemplate={promptTemplate}
                        temperature={temperature}
                        retrieveCount={retrieveCount}
                        maxSubqueryCount={maxSubqueryCount}
                        resultsMergeStrategy={resultsMergeStrategy}
                        seed={seed}
                        minimumSearchScore={minimumSearchScore}
                        minimumRerankerScore={minimumRerankerScore}
                        useSemanticRanker={useSemanticRanker}
                        useSemanticCaptions={useSemanticCaptions}
                        useQueryRewriting={useQueryRewriting}
                        reasoningEffort={reasoningEffort}
                        excludeCategory={excludeCategory}
                        includeCategory={includeCategory}
                        retrievalMode={retrievalMode}
                        useGPT4V={useGPT4V}
                        gpt4vInput={gpt4vInput}
                        vectorFields={vectorFields}
                        showSemanticRankerOption={showSemanticRankerOption}
                        showQueryRewritingOption={showQueryRewritingOption}
                        showReasoningEffortOption={showReasoningEffortOption}
                        showGPT4VOptions={showGPT4VOptions}
                        showVectorOption={showVectorOption}
                        useOidSecurityFilter={useOidSecurityFilter}
                        useGroupsSecurityFilter={useGroupsSecurityFilter}
                        useLogin={!!useLogin}
                        loggedIn={loggedIn}
                        requireAccessControl={requireAccessControl}
                        shouldStream={shouldStream}
                        streamingEnabled={streamingEnabled}
                        useSuggestFollowupQuestions={useSuggestFollowupQuestions}
                        showSuggestFollowupQuestions={true}
                        showAgenticRetrievalOption={showAgenticRetrievalOption}
                        useAgenticRetrieval={useAgenticRetrieval}
                        onChange={handleSettingsChange}
                    />
                    {useLogin && <TokenClaimsDisplay />}
                </Panel> */}
            </div>
            {/* モーダル */}
            {modalVisible && (
                <SimpleModal
                visible={modalVisible} 
                title={modalContent.title}
                onOk={hideModal}
                />
            )}
        </div>
        
    );
};

export default Chat;