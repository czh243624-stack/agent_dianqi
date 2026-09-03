export type AgentModule = "inquiry" | "seo" | "video";

type Props = {
  onOpen: (module: AgentModule) => void;
};

/** 询盘工作台入口 */
export function HomeModules({ onOpen }: Props) {
  return (
    <section className="home-workspace inquiry-only">
      <div className="home-brand-field">
        <h1>Inquiry Desk</h1>
        <p>
          易发式电气询盘工作台。接收海外买家来信，整理参数与参考资料，起草英文回复，沉淀客户跟进记录。
        </p>
        <button type="button" className="primary home-enter-btn" onClick={() => onOpen("inquiry")}>
          Open workspace
        </button>
      </div>

      <div className="home-board inquiry-scope">
        <div className="home-board-label">Inquiry Agent</div>
        <ul className="scope-list">
          <li>接收：独立站表单、阿里国际站询盘、手动录入</li>
          <li>分析：买家意图、关键参数、缺失字段、客户等级</li>
          <li>匹配：产品资料、认证资料、FAQ、历史回复</li>
          <li>协作：业务员审核、修改、发送并沉淀客户档案</li>
        </ul>
        <p className="scope-note">围绕外贸询盘处理、客户跟进和知识库复用运行。</p>
      </div>
    </section>
  );
}
