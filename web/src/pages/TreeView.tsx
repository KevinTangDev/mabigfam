import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactFamilyTree from "react-family-tree";
import calcTree from "relatives-tree";
import type { ExtNode } from "relatives-tree/lib/types";
import { api } from "../api/client";
import { useI18n } from "../i18n/context";
import type { BaseKey } from "../i18n/config";
import { buildRelativesTreeNodes } from "../lib/buildRelativesTree";
import { connectedComponent } from "../lib/connectedComponent";
import { buildPartnerConnectors, type PartnerConnector } from "../lib/partnerConnectors";
import FamilyNodeCard from "../components/FamilyNodeCard";
import Icon from "../components/icons";
import type { IconName } from "../components/icons";
import PanZoomCanvas from "../components/PanZoomCanvas";
import { EmptyState, PageHeader, Skeleton, cardClass, selectClass } from "../components/ui";
import type { FamilyMember, TreeData } from "../types";

/**
 * relatives-tree positions nodes on a grid of NODE_WIDTH x NODE_HEIGHT cells
 * and draws its connector lines between cell centres. Rendering a card at the
 * full cell size therefore covers those lines and leaves cards touching.
 *
 * So the cell is deliberately larger than the card: the difference is the
 * gutter, and the connectors show through it as the ancestry lines.
 */
const CELL_WIDTH = 252;
const CELL_HEIGHT = 140;
const CARD_GUTTER_X = 24;
const CARD_GUTTER_Y = 34;

const CARD_WIDTH = CELL_WIDTH - CARD_GUTTER_X * 2;
const CARD_HEIGHT = CELL_HEIGHT - CARD_GUTTER_Y * 2;

/** A grid-unit coordinate (ExtNode.left/top space) to a pixel offset within
 *  the tree canvas — the cell-centre counterpart of the card transform above. */
function cellCenter(units: number, cell: number): number {
  return units * (cell / 2) + cell / 2;
}

const PARTNER_BADGE: Record<
  PartnerConnector["status"],
  { icon: IconName; legend: BaseKey; tooltip: BaseKey; className: string }
> = {
  married: {
    icon: "heart",
    legend: "status.married",
    tooltip: "status.married",
    className: "border-ctp-pink bg-ctp-mantle text-ctp-pink",
  },
  partner: {
    icon: "users",
    legend: "status.partner",
    tooltip: "status.partner",
    className: "border-ctp-blue bg-ctp-mantle text-ctp-blue",
  },
  divorced: {
    icon: "heartCrack",
    legend: "status.divorced",
    tooltip: "status.divorced",
    className: "border-dashed border-ctp-red bg-ctp-mantle text-ctp-red",
  },
  inferred: {
    icon: "link",
    legend: "status.assumed",
    tooltip: "status.assumedTooltip",
    className: "border-dashed border-ctp-overlay0 bg-ctp-surface0 text-ctp-overlay1",
  },
};

export default function TreeView() {
  const { t, date, errorText } = useI18n();
  const { rootId: rootIdParam } = useParams<{ rootId?: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TreeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rootId, setRootId] = useState<string>(rootIdParam ?? "");

  useEffect(() => {
    api
      .getTree()
      .then((tree) => {
        setData(tree);
        if (!rootIdParam && tree.members.length > 0) {
          // Default to a member with no recorded parents (a "founder"), else the first.
          const founder = tree.members.find((m) => !tree.links.some((l) => l.childId === m.id));
          setRootId((founder ?? tree.members[0]).id);
        }
      })
      .catch((err) => setLoadError(errorText(err, "tree.loadFailed")));
    // errorText only changes with the language, which shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIdParam]);

  useEffect(() => {
    if (rootIdParam) setRootId(rootIdParam);
  }, [rootIdParam]);

  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    data?.members.forEach((m) => map.set(m.id, m));
    return map;
  }, [data]);

  const nodes = useMemo(() => {
    if (!data) return [];
    return buildRelativesTreeNodes(
      data.members.map((m) => m.id),
      data.links,
      data.partnerships,
    );
  }, [data]);

  /*
   * relatives-tree is handed only the root's own connected family — the
   * people reachable through parent, child and partner links — rather than
   * every member in the app. Selecting someone unrelated to everyone else
   * (or a founder in a separate branch) should show just them, or their own
   * descendants, not a warning about every other family in the database.
   * It also means relatives-tree's layout never has to reason about more
   * than one connected group of people at once, which is the most likely
   * source of a crash reported against a shape we could no longer reproduce
   * once the data had changed — its layout code is grouped around exactly
   * that concept ("root families").
   */
  const componentNodes = useMemo(() => {
    if (!rootId) return [];
    const component = connectedComponent(rootId, nodes);
    return nodes.filter((n) => component.has(n.id));
  }, [nodes, rootId]);

  /*
   * calcTree is run here first, in a try/catch, before handing the same
   * nodes to <ReactFamilyTree> (which calls it internally). Two reasons:
   *
   * 1. Its layout code can throw on graph shapes it doesn't model — and a
   *    throw inside render blanks the page. Catching it turns that into a
   *    message instead.
   * 2. Even within one connected family, it lays out children as belonging
   *    to a *couple* — so a child with only one parent recorded, whose
   *    parent has a partner, can still be silently dropped. Comparing its
   *    output against componentNodes is the only way to catch that.
   */
  const layout = useMemo(() => {
    if (!rootId || componentNodes.length === 0) return null;
    try {
      const result = calcTree(componentNodes, { rootId });
      return {
        nodes: result.nodes,
        canvas: result.canvas,
        error: null as string | null,
        detail: null as string | null,
      };
    } catch (err) {
      return {
        nodes: [],
        canvas: { width: 0, height: 0 },
        error: err instanceof Error ? err.message : "The tree layout failed unexpectedly.",
        // The stack (when the engine provides one) is what would actually let
        // this be tracked down if it recurs — the bare message alone doesn't
        // say which internal function or data shape was involved.
        detail: err instanceof Error && err.stack ? err.stack : null,
      };
    }
  }, [componentNodes, rootId]);

  const missing = useMemo(() => {
    if (!layout || layout.error) return [];
    const shown = new Set(layout.nodes.map((n) => n.id));
    return componentNodes
      .filter((n) => !shown.has(n.id))
      .map((n) => memberById.get(n.id))
      .filter((m): m is FamilyMember => !!m);
  }, [componentNodes, layout, memberById]);

  const partnerConnectors = useMemo(() => {
    if (!layout || layout.error) return [];
    return buildPartnerConnectors(layout.nodes, data?.partnerships ?? []);
  }, [layout, data]);

  // One horizontal band per generation row, oldest at the top.
  const generationRows = useMemo(() => {
    if (!layout || layout.error) return [];
    return [...new Set(layout.nodes.map((n) => n.top))].sort((a, b) => a - b);
  }, [layout]);

  if (loadError) return <p className="text-sm text-ctp-red">{loadError}</p>;

  if (!data) {
    return <Skeleton className="h-[28rem]" />;
  }

  if (data.members.length === 0) {
    return (
      <div className={cardClass}>
        <EmptyState icon="tree" title={t("tree.empty.title")}>
          {t("tree.empty.body")}
        </EmptyState>
      </div>
    );
  }

  if (!rootId || !nodes.some((n) => n.id === rootId)) {
    return <Skeleton className="h-[28rem]" />;
  }

  const rootNode = layout?.nodes.find((n) => n.id === rootId);
  const contentWidth = (layout?.canvas.width ?? 0) * (CELL_WIDTH / 2);
  const contentHeight = (layout?.canvas.height ?? 0) * (CELL_HEIGHT / 2);

  return (
    <div>
      <PageHeader
        title={t("tree.title")}
        subtitle={t("tree.subtitle")}
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <label className="flex items-center gap-2.5 text-sm font-semibold text-ctp-subtext1">
          {t("tree.viewingFrom")}
          <select
            value={rootId}
            onChange={(e) => navigate(`/tree/${e.target.value}`)}
            className={`${selectClass} max-w-[14rem] sm:max-w-xs`}
          >
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-medium text-ctp-subtext0 sm:ml-auto">
          {Object.values(PARTNER_BADGE).map((badge) => (
            <span key={badge.legend} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`flex size-5 items-center justify-center rounded-full border ${badge.className}`}
              >
                <Icon name={badge.icon} className="size-3" />
              </span>
              {t(badge.legend)}
            </span>
          ))}
        </span>
      </div>

      {layout?.error && (
        <div className={`${cardClass} border-ctp-red/40 p-5`}>
          <h3 className="font-semibold text-ctp-red">{t("tree.err.title")}</h3>
          <p className="mt-2 text-sm text-ctp-subtext0">{t("tree.err.p1")}</p>
          <p className="mt-2 text-sm text-ctp-subtext0">
            {t("tree.err.p2a")}{" "}
            <button
              onClick={() => window.location.reload()}
              className="cursor-pointer font-medium text-brand underline underline-offset-2"
            >
              {t("tree.err.reload")}
            </button>{" "}
            {t("tree.err.p2b")}
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-ctp-crust/60 p-3 text-xs text-ctp-peach">
            {layout.error}
          </pre>
          {layout.detail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-ctp-overlay1">
                {t("tree.err.details")}
              </summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-ctp-crust/60 p-3 text-xs text-ctp-overlay1">
                {layout.detail}
              </pre>
            </details>
          )}
        </div>
      )}

      {missing.length > 0 && (
        <div className={`${cardClass} mb-4 border-ctp-yellow/40 p-4`}>
          <h3 className="text-sm font-semibold text-ctp-yellow">
            {t("tree.missing.title", { count: missing.length })}
          </h3>
          <p className="mt-1 text-sm text-ctp-subtext0">{t("tree.missing.body")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => navigate(`/tree/${m.id}`)}
                  className="cursor-pointer rounded-full border border-ctp-surface1 bg-ctp-surface0
                             px-2.5 py-1 text-xs font-medium text-ctp-text transition
                             hover:border-brand"
                  title={t("tree.viewFrom", { name: m.name })}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!layout?.error && (
        <PanZoomCanvas
          contentWidth={contentWidth}
          contentHeight={contentHeight}
          focusX={rootNode ? cellCenter(rootNode.left, CELL_WIDTH) : contentWidth / 2}
          focusY={rootNode ? cellCenter(rootNode.top, CELL_HEIGHT) : contentHeight / 2}
          resetKey={rootId}
        >
          <div className="relative" style={{ width: contentWidth, height: contentHeight }}>
            {/*
              Soft horizontal bands, one per generation, so the rows read as
              generations at a glance. Deliberately a sibling of the tree
              canvas (not a child): react-family-tree owns that div's children.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {generationRows.map((top, i) => (
                <div
                  key={top}
                  className={`absolute inset-x-0 rounded-2xl ${i % 2 === 0 ? "bg-ctp-surface0/35" : "bg-ctp-surface0/15"}`}
                  style={{ top: top * (CELL_HEIGHT / 2) + 6, height: CELL_HEIGHT - 12 }}
                >
                  <span className="absolute top-1.5 left-3 text-[10px] font-bold tracking-wider text-ctp-overlay1 uppercase">
                    {t("tree.generation", { n: i + 1 })}
                  </span>
                </div>
              ))}
            </div>

            <ReactFamilyTree
              nodes={componentNodes}
              rootId={rootId}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              className="tree-canvas"
              renderNode={(node: ExtNode) => (
                <FamilyNodeCard
                  key={node.id}
                  node={node}
                  member={memberById.get(node.id)}
                  isRoot={node.id === rootId}
                  onSelect={(id) => navigate(`/members/${id}`)}
                  onFocusTree={(id) => navigate(`/tree/${id}`)}
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    // Offset by the gutter so the card sits inset within its cell.
                    transform: `translate(${node.left * (CELL_WIDTH / 2) + CARD_GUTTER_X}px, ${
                      node.top * (CELL_HEIGHT / 2) + CARD_GUTTER_Y
                    }px)`,
                  }}
                />
              )}
            />

            {/*
              react-family-tree owns the canvas div and draws every connector
              (ancestry and partnership alike) as an identical grey segment —
              see index.css. This overlay sits on top of it, placing one badge
              per rendered partnership at the midpoint between the two cards
              (right where relatives-tree already put its plain line), so the
              status is visible instead of implied by adjacency alone.
            */}
            <div className="pointer-events-none absolute inset-0">
              {partnerConnectors.map((connector) => {
                const badge = PARTNER_BADGE[connector.status];
                const a = memberById.get(connector.aId)?.name ?? t("common.unknown");
                const b = memberById.get(connector.bId)?.name ?? t("common.unknown");
                const since = connector.since
                  ? t("status.since", {
                      date: date(connector.since, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
                    })
                  : "";
                const title =
                  connector.status === "inferred"
                    ? `${a} & ${b} — ${t(badge.tooltip)}`
                    : `${a} & ${b} — ${t(badge.tooltip)}${since}`;
                return (
                  <span
                    key={`${connector.aId}-${connector.bId}`}
                    role="img"
                    aria-label={title}
                    title={title}
                    className={`pointer-events-auto absolute flex size-7 -translate-x-1/2
                                -translate-y-1/2 items-center justify-center rounded-full border-2
                                shadow-card ${badge.className}`}
                    style={{
                      left: cellCenter(connector.x, CELL_WIDTH),
                      top: cellCenter(connector.y, CELL_HEIGHT),
                    }}
                  >
                    <Icon name={badge.icon} className="size-3.5" />
                  </span>
                );
              })}
            </div>
          </div>
        </PanZoomCanvas>
      )}

      <p className="mt-3 text-center text-xs text-ctp-overlay1">
        <Link to="/contacts" className="font-semibold text-brand">
          {t("tree.manage.link")}
        </Link>{" "}
        {t("tree.manage.rest")}
      </p>
    </div>
  );
}
