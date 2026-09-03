import { useEffect, useState } from "react";
import {
  SOURCE_TYPE_LABEL,
  createCertification,
  createKnowledgeDocument,
  createProduct,
  formatTime,
  listCertifications,
  listKnowledgeDocuments,
  listProducts,
  searchKnowledge,
  updateKnowledgeDocument,
  type Certification,
  type KnowledgeDocument,
  type KnowledgeSearchHit,
  type Product,
} from "../api";
import { Dialog } from "../components/Dialog";

const DOC_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const DOC_TYPES = [
  { value: "manual_entry", label: "人工录入" },
  { value: "faq", label: "FAQ" },
  { value: "first_reply_template", label: "首封回复模板" },
  { value: "sales_reply_policy", label: "回复口径" },
  { value: "certification_note", label: "认证口径" },
  { value: "product_scope", label: "产品范围" },
  { value: "product_data_policy", label: "产品资料规则" },
  { value: "quote_rule", label: "报价规则" },
  { value: "delivery_rule", label: "交期规则" },
  { value: "commercial_terms_policy", label: "付款与报价有效期" },
  { value: "company_profile", label: "公司资料" },
  { value: "policy", label: "对外口径" },
];

const PRODUCT_TYPES = [
  "Power transformer",
  "Oil-immersed power transformer",
  "Oil-immersed distribution transformer",
  "Dry-type transformer",
  "Three-winding power transformer",
  "OLTC transformer",
  "Reactor",
  "Mobile substation",
  "Prefabricated substation",
  "Box-type transformer / compact substation",
];

const SEARCH_EXAMPLES = ["CE certification 132kV", "紧急交期", "Payment terms", "SCB10 dry type", "A级客户 24小时"];

type TabId = "search" | "docs" | "products" | "certs";

function visibilityLabel(value: string) {
  if (value === "restricted") return "受限内部";
  if (value === "public_reference") return "公开参考";
  return "内部";
}

function emptyDocForm() {
  return {
    sourceType: "manual_entry",
    title: "",
    content: "",
    tags: "",
    visibility: "internal",
    version: "",
  };
}

function emptyProductForm() {
  return {
    model: "",
    type: "Power transformer",
    capacityKva: "",
    voltagePrim: "",
    voltageSec: "",
    frequency: "",
    cooling: "",
    standard: "",
    summary: "",
  };
}

function emptyCertForm() {
  return {
    name: "",
    market: "",
    modelScope: "",
    validUntil: "",
    summary: "",
  };
}

function parseTags(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function KnowledgePage() {
  const [tab, setTab] = useState<TabId>("search");
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState<(typeof DOC_PAGE_SIZE_OPTIONS)[number]>(10);
  const [docTotal, setDocTotal] = useState(0);
  const [docTotalPages, setDocTotalPages] = useState(1);
  const [docLoading, setDocLoading] = useState(false);
  const [docSearchInput, setDocSearchInput] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);

  const [queryInput, setQueryInput] = useState("");
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");

  const [docOpen, setDocOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [docForm, setDocForm] = useState(emptyDocForm());
  const [productOpen, setProductOpen] = useState(false);
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [certOpen, setCertOpen] = useState(false);
  const [certForm, setCertForm] = useState(emptyCertForm());

  const reloadCatalog = async () => {
    const [p, c] = await Promise.all([listProducts(), listCertifications()]);
    setProducts(p.items);
    setCerts(c.items);
  };

  const reloadDocs = async (page = docPage, pageSize = docPageSize, q = docSearch) => {
    setDocLoading(true);
    try {
      const d = await listKnowledgeDocuments({ page, pageSize, q: q || undefined });
      setDocs(d.items);
      setDocPage(d.page);
      setDocPageSize(d.pageSize as (typeof DOC_PAGE_SIZE_OPTIONS)[number]);
      setDocTotal(d.total);
      setDocTotalPages(d.totalPages);
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    reloadCatalog().catch((e) => setError(String((e as Error).message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError("");
    reloadDocs(docPage, docPageSize, docSearch).catch((e) => setError(String((e as Error).message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPage, docPageSize, docSearch]);

  const runSearch = async (raw = queryInput) => {
    const q = raw.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    setHint("");
    try {
      const data = await searchKnowledge(q, 16);
      setHits(data.items);
      setSearchedQuery(data.query);
      if (!data.items.length) setHint("没有检索到匹配资料。可以换关键词，或先在资料库里录入。");
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setSearching(false);
    }
  };

  const openCreateDoc = () => {
    setEditingDoc(null);
    setDocForm(emptyDocForm());
    setDocOpen(true);
  };

  const openEditDoc = (doc: KnowledgeDocument) => {
    setEditingDoc(doc);
    setDocForm({
      sourceType: doc.sourceType,
      title: doc.title,
      content: doc.content,
      tags: doc.tags.join(", "),
      visibility: doc.visibility || "internal",
      version: doc.version || "",
    });
    setDocOpen(true);
  };

  const saveDoc = async () => {
    if (!docForm.title.trim() || !docForm.content.trim()) {
      setError("请填写资料标题和内容");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        sourceType: docForm.sourceType,
        title: docForm.title.trim(),
        content: docForm.content.trim(),
        tags: parseTags(docForm.tags),
        visibility: docForm.visibility,
        version: docForm.version.trim() || undefined,
      };
      if (editingDoc) await updateKnowledgeDocument(editingDoc.id, payload);
      else await createKnowledgeDocument(payload);
      setDocOpen(false);
      setHint(editingDoc ? "资料已更新，检索会立刻用到。" : "资料已录入，检索和询盘分析会立刻用到。");
      await reloadDocs(1, docPageSize, docSearch);
      setDocPage(1);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async () => {
    if (!productForm.model.trim() || !productForm.type.trim()) {
      setError("请填写产品型号和类型");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const capacity = productForm.capacityKva.trim() ? Number(productForm.capacityKva) : undefined;
      await createProduct({
        model: productForm.model.trim(),
        type: productForm.type.trim(),
        capacityKva: Number.isFinite(capacity) ? capacity : undefined,
        voltagePrim: productForm.voltagePrim.trim() || undefined,
        voltageSec: productForm.voltageSec.trim() || undefined,
        frequency: productForm.frequency.trim() || undefined,
        cooling: productForm.cooling.trim() || undefined,
        standard: productForm.standard.trim() || undefined,
        summary: productForm.summary.trim() || undefined,
      });
      setProductOpen(false);
      setProductForm(emptyProductForm());
      setHint("产品已录入，检索和询盘匹配会立刻用到。");
      await reloadCatalog();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const saveCert = async () => {
    if (!certForm.name.trim()) {
      setError("请填写认证名称");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createCertification({
        name: certForm.name.trim(),
        market: certForm.market.trim() || undefined,
        modelScope: certForm.modelScope.trim() || undefined,
        validUntil: certForm.validUntil || undefined,
        summary: certForm.summary.trim() || undefined,
      });
      setCertOpen(false);
      setCertForm(emptyCertForm());
      setHint("认证资料已录入。对外回复仍需人工核对原件范围。");
      await reloadCatalog();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const addLabel =
    tab === "products" ? "新增产品" : tab === "certs" ? "新增认证" : "新增资料";

  return (
    <>
      <div className="ry-card">
        <div className="ry-card-hd">
          <h2>企业知识库</h2>
          {addLabel ? (
            <button
              className="ry-btn ry-btn-primary"
              type="button"
              onClick={() => {
                setError("");
                if (tab === "products") {
                  setProductForm(emptyProductForm());
                  setProductOpen(true);
                } else if (tab === "certs") {
                  setCertForm(emptyCertForm());
                  setCertOpen(true);
                } else {
                  openCreateDoc();
                }
              }}
            >
              {addLabel}
            </button>
          ) : null}
        </div>
        <div className="ry-card-bd">
          <div className="ry-alert ry-alert-info">
            录入的资料会进入询盘分析检索。价格、交期、认证范围仍须人工审核后才能发给客户。
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
          {hint ? <div className="ry-alert ry-alert-success">{hint}</div> : null}

          <div className="ry-tabs">
            <button type="button" className={`ry-tab ${tab === "docs" ? "on" : ""}`} onClick={() => setTab("docs")}>
              资料库
            </button>
            <button type="button" className={`ry-tab ${tab === "products" ? "on" : ""}`} onClick={() => setTab("products")}>
              产品库
            </button>
            <button type="button" className={`ry-tab ${tab === "certs" ? "on" : ""}`} onClick={() => setTab("certs")}>
              认证资料
            </button>
            <button type="button" className={`ry-tab ${tab === "search" ? "on" : ""}`} onClick={() => setTab("search")}>
              知识检索
            </button>
          </div>

          {tab === "search" ? (
            <>
              <div className="ry-toolbar">
                <input
                  className="ry-input grow"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch().catch(() => undefined);
                  }}
                  placeholder="输入买家问题或关键词，例如：CE、紧急交期、132kV dry type"
                />
                <button className="ry-btn ry-btn-primary" type="button" disabled={searching || !queryInput.trim()} onClick={() => runSearch()}>
                  {searching ? "检索中…" : "检索"}
                </button>
              </div>
              <div className="ry-toolbar" style={{ marginTop: 0 }}>
                {SEARCH_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    className="ry-btn ry-btn-plain"
                    type="button"
                    onClick={() => {
                      setQueryInput(example);
                      runSearch(example).catch(() => undefined);
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="ry-table-wrap">
                <table className="ry-table">
                  <thead>
                    <tr>
                      <th>相关度</th>
                      <th>类型</th>
                      <th>标题</th>
                      <th>摘要</th>
                      <th>版本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((hit) => (
                      <tr
                        key={`${hit.sourceType}:${hit.sourceId}`}
                        className={hit.sourceType !== "product" && hit.sourceType !== "certification" ? "clickable" : undefined}
                        onClick={() => {
                          if (hit.sourceType === "product" || hit.sourceType === "certification") return;
                          const doc = docs.find((item) => item.id === hit.sourceId);
                          if (doc) openEditDoc(doc);
                          else {
                            setTab("docs");
                            setDocSearchInput(hit.title);
                            setDocSearch(hit.title);
                            setDocPage(1);
                          }
                        }}
                      >
                        <td>{hit.score.toFixed(0)}</td>
                        <td>{SOURCE_TYPE_LABEL[hit.sourceType] || hit.sourceType}</td>
                        <td>{hit.title}</td>
                        <td>{hit.snippet}</td>
                        <td>{hit.version || "—"}</td>
                      </tr>
                    ))}
                    {!hits.length && !searching ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="ry-empty">
                            {searchedQuery ? "没有匹配结果" : "输入问题后检索产品、认证和资料。这与询盘分析用的是同一套检索。"}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {searching ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="ry-empty">正在检索知识库...</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {searchedQuery ? <div className="muted" style={{ marginTop: 8 }}>已检索：{searchedQuery} · {hits.length} 条</div> : null}
            </>
          ) : null}

          {tab === "docs" ? (
            <>
              <div className="ry-toolbar">
                <input
                  className="ry-input grow"
                  value={docSearchInput}
                  onChange={(event) => setDocSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setDocSearch(docSearchInput.trim());
                      setDocPage(1);
                    }
                  }}
                  placeholder="筛选类型、标题、标签、内容"
                />
                <button
                  className="ry-btn ry-btn-primary"
                  type="button"
                  onClick={() => {
                    setDocSearch(docSearchInput.trim());
                    setDocPage(1);
                  }}
                  disabled={docLoading}
                >
                  筛选
                </button>
                <button
                  className="ry-btn ry-btn-plain"
                  type="button"
                  onClick={() => {
                    setDocSearchInput("");
                    setDocSearch("");
                    setDocPage(1);
                  }}
                >
                  重置
                </button>
              </div>
              <div className="ry-table-wrap">
                <table className="ry-table">
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>标题</th>
                      <th>版本</th>
                      <th>可见性</th>
                      <th>内容摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id} className="clickable" onClick={() => openEditDoc(doc)}>
                        <td>{SOURCE_TYPE_LABEL[doc.sourceType] || doc.sourceType}</td>
                        <td>
                          {doc.title}
                          {doc.tags.length ? <span className="internal-note">{doc.tags.slice(0, 3).join(" / ")}</span> : null}
                        </td>
                        <td>{doc.version || "—"}</td>
                        <td>{visibilityLabel(doc.visibility)}</td>
                        <td>{doc.content.length > 180 ? `${doc.content.slice(0, 180)}...` : doc.content}</td>
                      </tr>
                    ))}
                    {!docs.length && !docLoading ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="ry-empty">{docSearch ? "没有找到匹配资料" : "暂无资料，可点击右上角新增"}</div>
                        </td>
                      </tr>
                    ) : null}
                    {docLoading ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="ry-empty">正在加载资料库...</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="ry-pager">
                <span>
                  共 {docTotal} 条 · 第 {docPage}/{docTotalPages} 页
                </span>
                <label className="ry-page-size">
                  每页
                  <select
                    className="ry-select"
                    value={docPageSize}
                    onChange={(event) => {
                      const next = Number(event.target.value) as (typeof DOC_PAGE_SIZE_OPTIONS)[number];
                      setDocPageSize(DOC_PAGE_SIZE_OPTIONS.includes(next) ? next : 10);
                      setDocPage(1);
                    }}
                  >
                    {DOC_PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} 行
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ry-page-btn" type="button" disabled={docPage <= 1 || docLoading} onClick={() => setDocPage((current) => Math.max(1, current - 1))}>
                  ‹
                </button>
                <button className="ry-page-btn on" type="button">
                  {docPage}
                </button>
                <button
                  className="ry-page-btn"
                  type="button"
                  disabled={docPage >= docTotalPages || docLoading}
                  onClick={() => setDocPage((current) => Math.min(docTotalPages, current + 1))}
                >
                  ›
                </button>
              </div>
            </>
          ) : null}

          {tab === "products" ? (
            <div className="ry-table-wrap">
              <table className="ry-table">
                <thead>
                  <tr>
                    <th>型号</th>
                    <th>类型</th>
                    <th>容量 kVA</th>
                    <th>电压</th>
                    <th>频率</th>
                    <th>冷却</th>
                    <th>标准</th>
                    <th>摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.model}</td>
                      <td>{p.type}</td>
                      <td>{p.capacityKva ?? "—"}</td>
                      <td>
                        {p.voltagePrim || "—"} / {p.voltageSec || "—"}
                      </td>
                      <td>{p.frequency || "—"}</td>
                      <td>{p.cooling || "—"}</td>
                      <td>{p.standard || "—"}</td>
                      <td>{p.summary || "—"}</td>
                    </tr>
                  ))}
                  {!products.length ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="ry-empty">暂无产品资料</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === "certs" ? (
            <div className="ry-table-wrap">
              <table className="ry-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>市场</th>
                    <th>适用型号</th>
                    <th>有效期</th>
                    <th>摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <span className="internal-note">内部参考，需人工确认</span>
                      </td>
                      <td>{c.market || "—"}</td>
                      <td>{c.modelScope || "—"}</td>
                      <td>{c.validUntil ? formatTime(c.validUntil) : "—"}</td>
                      <td>{c.summary || "—"}</td>
                    </tr>
                  ))}
                  {!certs.length ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="ry-empty">暂无认证资料</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={docOpen}
        title={editingDoc ? "编辑资料" : "新增资料"}
        onClose={() => setDocOpen(false)}
        onConfirm={saveDoc}
        confirmText={editingDoc ? "保存修改" : "录入知识库"}
        busy={busy}
        size="lg"
      >
        <div className="ry-grid-2">
          <div className="ry-form-row">
            <label>资料类型</label>
            <select className="ry-select block" value={docForm.sourceType} onChange={(e) => setDocForm((f) => ({ ...f, sourceType: e.target.value }))}>
              {DOC_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              {editingDoc && !DOC_TYPES.some((item) => item.value === editingDoc.sourceType) ? (
                <option value={editingDoc.sourceType}>{SOURCE_TYPE_LABEL[editingDoc.sourceType] || editingDoc.sourceType}</option>
              ) : null}
            </select>
          </div>
          <div className="ry-form-row">
            <label>可见性</label>
            <select className="ry-select block" value={docForm.visibility} onChange={(e) => setDocForm((f) => ({ ...f, visibility: e.target.value }))}>
              <option value="internal">内部</option>
              <option value="restricted">受限内部，不得外发</option>
              <option value="public_reference">公开参考</option>
            </select>
          </div>
        </div>
        <div className="ry-form-row">
          <label>标题 *</label>
          <input className="ry-input block" value={docForm.title} onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))} placeholder="例如：CE 认证对外回复口径" />
        </div>
        <div className="ry-form-row">
          <label>内容 *</label>
          <textarea
            className="ry-textarea"
            rows={10}
            value={docForm.content}
            onChange={(e) => setDocForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="写入可检索的官方口径、FAQ 或参数说明。不要写入成本、毛利或未批准证书范围。"
          />
        </div>
        <div className="ry-grid-2">
          <div className="ry-form-row">
            <label>标签</label>
            <input className="ry-input block" value={docForm.tags} onChange={(e) => setDocForm((f) => ({ ...f, tags: e.target.value }))} placeholder="用逗号分隔，例如：CE, IEC, 认证" />
          </div>
          <div className="ry-form-row">
            <label>版本</label>
            <input className="ry-input block" value={docForm.version} onChange={(e) => setDocForm((f) => ({ ...f, version: e.target.value }))} placeholder="可空，默认当天人工录入" />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={productOpen}
        title="新增产品"
        onClose={() => setProductOpen(false)}
        onConfirm={saveProduct}
        confirmText="录入产品"
        busy={busy}
        size="lg"
      >
        <div className="ry-grid-2">
          <div className="ry-form-row">
            <label>型号 *</label>
            <input className="ry-input block" value={productForm.model} onChange={(e) => setProductForm((f) => ({ ...f, model: e.target.value }))} placeholder="SCB10 Dry-Type Transformer" />
          </div>
          <div className="ry-form-row">
            <label>类型 *</label>
            <select className="ry-select block" value={productForm.type} onChange={(e) => setProductForm((f) => ({ ...f, type: e.target.value }))}>
              {PRODUCT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="ry-form-row">
            <label>容量 kVA</label>
            <input className="ry-input block" value={productForm.capacityKva} onChange={(e) => setProductForm((f) => ({ ...f, capacityKva: e.target.value }))} placeholder="2500 或 40000" />
          </div>
          <div className="ry-form-row">
            <label>频率</label>
            <input className="ry-input block" value={productForm.frequency} onChange={(e) => setProductForm((f) => ({ ...f, frequency: e.target.value }))} placeholder="50Hz / 60Hz" />
          </div>
          <div className="ry-form-row">
            <label>高压 HV</label>
            <input className="ry-input block" value={productForm.voltagePrim} onChange={(e) => setProductForm((f) => ({ ...f, voltagePrim: e.target.value }))} placeholder="10kV" />
          </div>
          <div className="ry-form-row">
            <label>低压 LV</label>
            <input className="ry-input block" value={productForm.voltageSec} onChange={(e) => setProductForm((f) => ({ ...f, voltageSec: e.target.value }))} placeholder="0.4kV" />
          </div>
          <div className="ry-form-row">
            <label>冷却</label>
            <input className="ry-input block" value={productForm.cooling} onChange={(e) => setProductForm((f) => ({ ...f, cooling: e.target.value }))} placeholder="ONAN / AN" />
          </div>
          <div className="ry-form-row">
            <label>标准</label>
            <input className="ry-input block" value={productForm.standard} onChange={(e) => setProductForm((f) => ({ ...f, standard: e.target.value }))} placeholder="IEC / GB subject to confirmation" />
          </div>
        </div>
        <div className="ry-form-row">
          <label>摘要</label>
          <textarea className="ry-textarea" rows={4} value={productForm.summary} onChange={(e) => setProductForm((f) => ({ ...f, summary: e.target.value }))} placeholder="用途、限制和对外可用口径" />
        </div>
      </Dialog>

      <Dialog
        open={certOpen}
        title="新增认证"
        onClose={() => setCertOpen(false)}
        onConfirm={saveCert}
        confirmText="录入认证"
        busy={busy}
      >
        <div className="ry-form-row">
          <label>认证名称 *</label>
          <input className="ry-input block" value={certForm.name} onChange={(e) => setCertForm((f) => ({ ...f, name: e.target.value }))} placeholder="CE marking / ISO9001" />
        </div>
        <div className="ry-grid-2">
          <div className="ry-form-row">
            <label>市场</label>
            <input className="ry-input block" value={certForm.market} onChange={(e) => setCertForm((f) => ({ ...f, market: e.target.value }))} placeholder="Europe / Global" />
          </div>
          <div className="ry-form-row">
            <label>有效期</label>
            <input className="ry-input block" type="date" value={certForm.validUntil} onChange={(e) => setCertForm((f) => ({ ...f, validUntil: e.target.value }))} />
          </div>
        </div>
        <div className="ry-form-row">
          <label>适用范围</label>
          <input className="ry-input block" value={certForm.modelScope} onChange={(e) => setCertForm((f) => ({ ...f, modelScope: e.target.value }))} placeholder="须按原件确认产品范围" />
        </div>
        <div className="ry-form-row">
          <label>摘要</label>
          <textarea className="ry-textarea" rows={4} value={certForm.summary} onChange={(e) => setCertForm((f) => ({ ...f, summary: e.target.value }))} placeholder="仅作线索。对外发送前必须核对原件。" />
        </div>
      </Dialog>
    </>
  );
}
