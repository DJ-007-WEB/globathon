/* Chat panel — page-specific rule-based chatbot. Different rules per page,
   never mixing data between pages. */

import { useChat } from "../hooks/useChat";
import { PageKey } from "../utils/chatRules";

interface ChatPanelProps {
  page: PageKey;
  data: any;
  onClose: () => void;
}

export const ChatPanel = ({ page, data, onClose }: ChatPanelProps) => {
  const { messages, input, setInput, submit, addSuggested } = useChat(page, data);

  const suggested: string[] = (() => {
    switch (page) {
      case "overview":
        return ["What is the gap?", "What is unexplained?", "Which scenario is selected?", "What does monthly signal show?"];
      case "analysis":
        return ["What does the waterfall show?", "What is Shapley?", "What is unexplained?", "What does reconciliation mean?"];
      case "class":
        return ["What is predictable?", "What is controllable?", "Is the weather extreme?", "What are confidence rules?"];
      case "valid":
        return ["What is truth vs recovered?", "Where is the hidden cause?", "Does reconciliation close?", "What is the tolerance?"];
      case "report":
        return ["What is in the report?", "Is the narrative checked?", "Can I print this?", "Is data synthetic?"];
      case "why":
        return ["Why is this different?", "How is it fast?", "What are coalitions?", "What are Monte Carlo bands?"];
      case "data":
        return ["What is the CSV format?", "How does upload work?", "What is unexplained in upload?", "What samples exist?"];
      default:
        return ["What can I ask?"];
    }
  })();

  return (
    <section id="chatPanel" className="chat-panel hide" aria-label="Variance Assistant">
      <header className="chat-head">
        <div className="chat-avatar">✳</div>
        <div>
          <b>Variance Assistant</b>
          <small>
            <span className="status-dot"></span> Rule-based demo assistant — {page} page
          </small>
        </div>
        <button id="chatClose" className="icon-btn" aria-label="Close assistant" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="chat-notice">
        Answers are based on the documented methods and current {page} page data only — no page's data is mixed into another.
      </div>
      <div id="chatMessages" className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.who}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="suggested-questions">
        {suggested.map((q, i) => (
          <button key={i} onClick={() => addSuggested(q)}>
            {q}
          </button>
        ))}
      </div>
      <form id="chatForm" className="chat-input-row" onSubmit={(e) => {
        e.preventDefault();
        submit(input);
      }}>
        <input
          id="chatInput"
          placeholder="Ask about this analysis…"
          autoComplete="off"
          aria-label="Ask the assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" aria-label="Send question">
          ↑
        </button>
      </form>
    </section>
  );
};
