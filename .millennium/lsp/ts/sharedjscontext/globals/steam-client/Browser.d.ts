import { Unregisterable } from './shared';
export interface Browser {
    AddWordToDictionary(word: string): void;
    ClearAllBrowsingData(): void;
    ClearHistory(): void;
    CloseDevTools(): void;
    GetBrowserID(): number;
    GetSpellingSuggestions(word: string): string[];
    GetSteamBrowserID(): Promise<number>;
    /**
     * Hides the mouse cursor until input.
     */
    HideCursorUntilMouseEvent(): void;
    /**
     * yup that's right, clientY and clientX are reversed
     */
    InspectElement(clientY: number, clientX: number): void;
    NotifyUserActivation(): void;
    OpenDevTools(): void;
    /**
     * Pastes the clipboard contents.
     */
    Paste(): void;
    /**
     * @note Not available on a created BrowserView.
     * @todo unconfirmed
     */
    RegisterForGestureEvents(callback: (gesture: TouchGesture) => void): Unregisterable;
    /**
     * @note Not available on a created BrowserView.
     */
    RegisterForOpenNewTab: Unregisterable;
    ReplaceMisspelling(param0: string): void;
    /**
     * Restarts the Steam JS context.
     */
    RestartJSContext(): void;
    SetBackgroundThrottlingDisabled(value: boolean): void;
    SetPendingFilePath(path: string): Promise<boolean>;
    SetShouldExitSteamOnBrowserClosed(value: boolean): Promise<void>;
    SetTouchGesturesToCancel(gestures: ETouchGesture[]): void;
    /**
     * Prompts and downloads a file.
     * @param url The URL of the file to download.
     */
    StartDownload(url: string): void;
}
export interface TouchGesture {
    eTouchGesture: ETouchGesture;
    x: number;
    y: number;
}
export declare enum ETouchGesture {
    None = 0,
    Touch = 1,
    Tap = 2,
    DoubleTap = 3,
    ShortPress = 4,
    LongPress = 5,
    LongTap = 6,
    TwoFingerTap = 7,
    TapCancelled = 8,
    PinchBegin = 9,
    PinchUpdate = 10,
    PinchEnd = 11,
    FlingStart = 12,
    FlingCancelled = 13
}
