import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { configurationFixture } from "./fixture";
import { BEFORE_UPDATE_KEY, PwaUpdateNotice } from "../components/PwaUpdateNotice";
import { InstallPage } from "../pages/InstallPage";

const controls = vi.hoisted(() => ({
  needed: false, busy: false, update: vi.fn().mockResolvedValue(undefined),
  options: {} as { onNeedReload?: () => void; onRegisteredSW?: (url: string, registration?: ServiceWorkerRegistration) => void },
}));
vi.mock("virtual:pwa-register/react", () => ({useRegisterSW: (options: typeof controls.options) => {
  controls.options = options;
  return {needRefresh:[controls.needed,vi.fn()],updateServiceWorker:controls.update};
}}));
vi.mock("../state/AppState",()=>({useAppState:()=>({configuration:configurationFixture,inputReport:null,generation:null,busy:controls.busy})}));

beforeEach(() => { controls.needed=false;controls.busy=false;controls.update.mockClear();vi.restoreAllMocks(); });
describe("safe PWA updates",()=>{
  it("does not ask for refresh without a waiting update",()=>{
    render(<PwaUpdateNotice/>);expect(screen.queryByRole("button")).toBeNull();
  });
  it("activates only on consent and backs up the saved project without clearing storage",async()=>{
    controls.needed=true;vi.spyOn(window,"confirm").mockReturnValue(true);
    localStorage.setItem("existing-project","unchanged");
    render(<PwaUpdateNotice/>);
    expect(controls.update).not.toHaveBeenCalled();
    await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Odśwież aplikację"})));
    expect(controls.update).toHaveBeenCalledWith(true);
    expect(JSON.parse(localStorage.getItem(BEFORE_UPDATE_KEY)!).configuration).toEqual(configurationFixture);
    expect(localStorage.getItem("existing-project")).toBe("unchanged");
  });
  it("does not interrupt generation or refresh after cancellation",async()=>{
    controls.needed=true;controls.busy=true;vi.spyOn(window,"confirm").mockReturnValue(false);
    const {rerender}=render(<PwaUpdateNotice/>);
    expect(screen.getByRole("button")).toBeDisabled();
    controls.busy=false;rerender(<PwaUpdateNotice/>);
    await act(async()=>fireEvent.click(screen.getByRole("button")));
    expect(controls.update).not.toHaveBeenCalled();
  });
  it("does not activate if creating a backup fails",async()=>{
    controls.needed=true;vi.spyOn(window,"confirm").mockReturnValue(true);
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("quota");});
    render(<PwaUpdateNotice/>);
    await act(async()=>fireEvent.click(screen.getByRole("button")));
    expect(controls.update).not.toHaveBeenCalled();expect(screen.getByRole("alert")).toHaveTextContent("Aplikacji nie odświeżono");
  });
  it("checks on registration and does not reload after activation in another tab",async()=>{
    render(<PwaUpdateNotice/>);
    const update=vi.fn().mockResolvedValue(undefined);
    act(()=>controls.options.onRegisteredSW?.("/sw.js",{update} as unknown as ServiceWorkerRegistration));
    expect(update).toHaveBeenCalledOnce();
    fireEvent.focus(window);expect(update).toHaveBeenCalledOnce();
    act(()=>controls.options.onNeedReload?.());
    expect(screen.getByRole("button",{name:"Odśwież aplikację"})).toBeEnabled();
    expect(controls.update).not.toHaveBeenCalled();
  });
  it("ignores first control but offers refresh when another tab changes the controller",()=>{
    const workers=Object.assign(new EventTarget(),{controller:null as object|null});
    vi.stubGlobal("navigator",Object.assign(Object.create(navigator),{serviceWorker:workers}));
    try {
      render(<PwaUpdateNotice/>);
      workers.controller={};
      act(()=>workers.dispatchEvent(new Event("controllerchange")));
      expect(screen.queryByRole("button")).toBeNull();
      act(()=>workers.dispatchEvent(new Event("controllerchange")));
      expect(screen.getByRole("button",{name:"Odśwież aplikację"})).toBeEnabled();
      expect(controls.update).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("Windows PWA installation",()=>{
  it("offers browser instructions when no native install prompt is available",()=>{
    render(<MemoryRouter><InstallPage/></MemoryRouter>);
    expect(screen.getByRole("heading",{name:/bez pliku EXE/})).toBeVisible();
    expect(screen.getByText(/Zainstaluj tę witrynę jako aplikację/)).toBeVisible();
    expect(screen.getByRole("link",{name:"Eksport i import projektu"})).toHaveAttribute("href","/urzadzenia");
  });
  it("opens the browser install prompt only after the user's click",async()=>{
    render(<MemoryRouter><InstallPage/></MemoryRouter>);
    const prompt=vi.fn().mockResolvedValue(undefined);
    act(()=>window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"),{prompt,userChoice:Promise.resolve({outcome:"accepted",platform:"web"})})));
    expect(prompt).not.toHaveBeenCalled();
    await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Zainstaluj Harmonogram w Windows"})));
    expect(prompt).toHaveBeenCalledOnce();expect(screen.getByRole("status")).toHaveTextContent("Zaakceptowano");
  });
});
