/**
 * Where the player is in the front end: loading, the "Turn on the light"
 * page, the title, the menu, or playing. Panels (settings, credits, play
 * together, chapters) and the notebook open on top.
 *
 * The stage is mirrored on <html data-stage> for tests: "waiting", "title",
 * "menu", then "ready" once the player can walk.
 */
export type Stage = "loading" | "waiting" | "title" | "menu" | "play";
export type PanelId = "settings" | "credits" | "together" | "chapters" | "map";

class Flow {
  stage = $state<Stage>("loading");
  panel = $state<PanelId | null>(null);
  notebook = $state(false);
  emotes = $state(false);
  /** The page the notebook opens on. */
  notebookPage = $state(0);

  setStage(stage: Stage): void {
    this.stage = stage;
    document.documentElement.dataset["stage"] = stage === "play" ? "ready" : stage;
  }

  open(panel: PanelId): void {
    this.panel = panel;
    this.sync();
  }

  close(): void {
    this.panel = null;
    this.sync();
  }

  setNotebook(open: boolean, page?: number): void {
    this.notebook = open;
    if (page !== undefined) this.notebookPage = page;
    this.sync();
  }

  /** True when something covers the world. */
  get covered(): boolean {
    return this.panel !== null || this.notebook;
  }

  private sync(): void {
    const root = document.documentElement;
    if (this.panel !== null || this.notebook) root.dataset["overlay"] = this.notebook ? "notebook" : this.panel ?? "";
    else delete root.dataset["overlay"];
  }
}

export const flow = new Flow();
