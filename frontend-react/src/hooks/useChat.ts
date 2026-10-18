/* Page-specific rule-based chatbot hook.
   Each page gets its own rule set from CHAT_RULES. The chatbot only ever
   reads the current page's data — pages never mix. */

import { useState, useCallback } from "react";
import { CHAT_RULES, getChatAnswer, PageKey } from "../utils/chatRules";

interface Message {
  text: string;
  who: "user" | "assistant";
}

export const useChat = (page: PageKey, data: any) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      who: "assistant",
      text: "Hi! I can explain the current page. Ask about the data shown here.",
    },
  ]);
  const [input, setInput] = useState("");

  const addMessage = useCallback((text: string, who: Message["who"]) => {
    setMessages((prev) => [...prev, { text, who }]);
  }, []);

  const submit = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      addMessage(trimmed, "user");
      setInput("");
      const answer = getChatAnswer(page, trimmed, data);
      setTimeout(() => addMessage(answer, "assistant"), 100);
    },
    [page, data, addMessage]
  );

  const addSuggested = useCallback((text: string) => {
    addMessage(text, "user");
    const answer = getChatAnswer(page, text, data);
    setTimeout(() => addMessage(answer, "assistant"), 100);
  }, [page, data, addMessage]);

  return { messages, input, setInput, submit, addSuggested };
};
