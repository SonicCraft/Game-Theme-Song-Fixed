import type { EResult, JsPbMessage, OperationResponse, Unregisterable, VDFBoolean_t } from './shared';
import type { EControllerRumbleSetting, EThirdPartyControllerConfiguration } from './Input';
import { EUCMFilePrivacyState, Screenshot } from './Screenshots';
/**
 * Represents various functions related to Steam applications.
 */
export interface Apps {
    /**
     * Adds a non-Steam application shortcut to the local Steam library.
     * @param appName The name of the non-Steam application.
     * @param executablePath The path to the executable file of the non-Steam application.
     * @param directory The working directory for the non-Steam application.
     * @param launchOptions Options to be passed when launching the non-Steam application.
     * @returns a unique AppID assigned to the added non-Steam application shortcut.
     */
    AddShortcut(appName: string, executablePath: string, directory: string, launchOptions: string): Promise<number>;
    /**
     * Backups an app to the specified path.
     * @param appId The ID of the application to back up.
     * @param backupPath The path to store the backup.
     * @returns a number. This value may be "20" for backup busy and "0" for success.
     */
    BackupFilesForApp(appId: number, backupPath: string): Promise<number>;
    /**
     * Opens the screenshot folder for a specific app.
     * @param appId The ID of the app to browse screenshots for.
     * @param handle The screenshot handle to use.
     */
    BrowseScreenshotForApp(appId: string, handle: number): void;
    /**
     * Opens the screenshot folder for a specific app.
     * @param appId The ID of the app to browse screenshots for.
     */
    BrowseScreenshotsForApp(appId: string): void;
    /**
     * Cancels the current backup process.
     */
    CancelBackup(): void;
    /**
     * Cancels a specific game action.
     * @param gameActionId The ID of the game action to cancel.
     */
    CancelGameAction(gameActionId: number): void;
    /**
     * Cancels the launch of an application with the specified ID.
     * @param appId The ID of the application whose launch is to be canceled.
     */
    CancelLaunch(appId: string): void;
    /**
     * Clears the custom artwork for a given application.
     * @param appId The ID of the application to clear custom artwork for.
     * @param assetType The type of artwork to clear.
     */
    ClearCustomArtworkForApp(appId: number, assetType: ELibraryAssetType): Promise<void>;
    /**
     * Clears the custom logo position for a specific application.
     * @param appId The ID of the application.
     * @returns A Promise that resolves once the custom logo position is cleared.
     */
    ClearCustomLogoPositionForApp(appId: number): Promise<void>;
    ClearProton(appId: number): Promise<void>;
    /**
     * Continues a specific game action.
     * @param gameActionId The ID of the game action to continue.
     * @param actionType The type of action to perform during continuation.
     * @remarks actionType - "SkipShaders", "skip", "ShowDurationControl" todo:
     */
    ContinueGameAction(gameActionId: number, actionType: string): void;
    /**
     * Creates a Steam application shortcut on the desktop.
     * @param appId The ID of the application for which to create a desktop shortcut.
     */
    CreateDesktopShortcutForApp(appId: number): void;
    /**
     * Download a workshop item.
     * @param appId The ID of the application.
     * @param itemId The ID of the workshop item.
     */
    DownloadWorkshopItem(appId: number, itemId: string, param1: boolean): void;
    /**
     * Retrieves achievements within a specified time range for a given app.
     * @param appId The ID of the application.
     * @param start The start of the time range as a Unix timestamp.
     * @param end The end of the time range as a Unix timestamp.
     * @returns an array of AppAchievement objects.
     * @throws OperationResponse
     */
    GetAchievementsInTimeRange(appId: number, start: number, end: number): Promise<AppAchievement[]>;
    /**
     * Retrieves a list of active game actions, such as launching an application.
     * @returns an array of active game actions.
     */
    GetActiveGameActions(): Promise<GameAction[]>;
    /**
     * Retrieves a list of available compatibility tools for a specific application.
     * @param appId The ID of the application to retrieve compatibility tools for.
     * @returns an array of CompatibilityToolInfo objects.
     */
    GetAvailableCompatTools(appId: number): Promise<CompatibilityTool[]>;
    /**
     * Represents a function to retrieve the name of the application in a backup folder.
     * @param appBackupPath The path to the application's backup folder.
     * @returns the name of the application in the backup folder, or undefined if the path is invalid.
     * @remarks This function checks for the "sku.sis" file in that path.
     */
    GetBackupsInFolder(appBackupPath: string): Promise<string | undefined>;
    /**
     * Retrieves cached details for a specific application.
     * @param appId The ID of the application.
     * @returns a stringified object. Returns {@link CachedAppDetails} when parsed.
     */
    GetCachedAppDetails(appId: number): Promise<string>;
    /**
     * @returns a ProtoBuf message. If deserialized, returns {@link CMsgCloudPendingRemoteOperations}.
     */
    GetCloudPendingRemoteOperations(appId: number): Promise<{
        PendingOperations: ArrayBuffer;
    }>;
    GetCompatExperiment(param0: number): Promise<string>;
    GetConflictingFileTimestamps(appId: number): Promise<ConflictingFileTimestamp>;
    /**
     * Retrieves details for a specific screenshot upload.
     * @param appId The ID of the application.
     * @param hHandle The handle of the screenshot upload.
     * @returns details about the screenshot upload.
     */
    GetDetailsForScreenshotUpload(appId: string, hHandle: number): Promise<ScreenshotUploadDetails>;
    /**
     * Retrieves details for multiple screenshot uploads.
     * @param appId The ID of the application.
     * @param hHandles An array of handles of the screenshot uploads.
     * @returns details about the screenshot uploads.
     */
    GetDetailsForScreenshotUploads(appId: string, hHandles: number[]): Promise<ScreenshotUploadsDetails>;
    /**
     * Retrieves a list of downloaded workshop items for a specific application.
     * @param appId The ID of the application to retrieve downloaded workshop items for.
     * @returns an array of downloaded workshop items for the specified application.
     */
    GetDownloadedWorkshopItems(appId: number): Promise<WorkshopItem[]>;
    GetDurationControlInfo(appId: number): Promise<{
        bApplicable: boolean;
    }>;
    /**
     * Retrieves achievement information for a specific application for a given friend.
     * @param appId The ID of the application to retrieve achievement information for.
     * @param friendSteam64Id The Steam64 ID of the friend for whom to retrieve achievement information.
     * @returns an object containing achievement information for the specified friend and application.
     */
    GetFriendAchievementsForApp(appId: string, friendSteam64Id: string): Promise<AppAchievementResponse>;
    /**
     * Retrieves a list of friends who play the specified application.
     * @param appId The ID of the application.
     * @returns an array of Steam64 IDs representing friends who play the application.
     */
    GetFriendsWhoPlay(appId: number): Promise<string[]>;
    /**
     * Retrieves details of a game action.
     * @param appId The ID of the application.
     * @param callback The callback function to handle the retrieved game action details and state.
     * @param callback.gameAction The game action received in the callback.
     * @param callback.state The state manager received in the callback.
     */
    GetGameActionDetails(appId: number, callback: (gameAction: GameAction) => void): void;
    GetGameActionForApp(appId: string, callback: (gameActionId: number, appId: 0 | string, taskName: AppAction_t) => void): void;
    /**
     * Retrieves launch options for a specified application.
     * These options may include different configurations or settings for launching the application, such as DirectX, Vulkan, OpenGL, 32-bit, 64-bit, etc.
     * This function does not retrieve launch/argument options inputted by the user.
     * @param appId The ID of the application.
     * @returns an array of launch options for the specified application.
     */
    GetLaunchOptionsForApp(appId: number): Promise<LaunchOption[]>;
    /**
     * @returns a ProtoBuf message. If deserialized, returns {@link CLibraryBootstrapData}.
     */
    GetLibraryBootstrapData(): Promise<ArrayBuffer>;
    /**
     * Retrieves achievement information for the authenticated user in a specific Steam application.
     * @param appId The ID of the application to retrieve achievement information for.
     * @returns an AppAchievementResponse object containing the achievement information for the authenticated user in the specified application.
     */
    GetMyAchievementsForApp(appId: string): Promise<AppAchievementResponse>;
    /**
     * Retrieves the playtime information for a specific application.
     * @param appId The ID of the application to get playtime information for.
     * @returns playtime information or undefined if not available.
     */
    GetPlaytime(appId: number): Promise<Playtime | undefined>;
    GetPrePurchasedApps(appIds: number[]): Promise<PrePurchaseInfo>;
    /**
     * Retrieves the resolution override for a specific application.
     * @param appId The ID of the application to retrieve the resolution override for.
     * @returns a string of the resolution override.
     */
    GetResolutionOverrideForApp(appId: number): Promise<string>;
    /**
     * Represents a function to retrieve detailed information about a specific screenshot.
     * @param appId The ID of the application the screenshot belongs to.
     * @param hHandle The handle of the screenshot.
     * @returns detailed information about the specified screenshot.
     */
    GetScreenshotInfo(appId: string, hHandle: number): Promise<Screenshot>;
    /**
     * Represents a function to retrieve screenshots within a specified time range.
     * @param appId The ID of the application.
     * @param start The start of the time range as a Unix timestamp.
     * @param end The end of the time range as a Unix timestamp.
     * @returns an array of screenshots taken within the specified time range.
     */
    GetScreenshotsInTimeRange(appId: number, start: number, end: number): Promise<Screenshot[]>;
    /**
     * Retrieves shortcut data for a given shortcut file path.
     * @param pathToShortcut The path to the shortcut file.
     * @returns the shortcut data.
     */
    GetShortcutDataForPath(pathToShortcut: string): Promise<Shortcut>;
    /**
     * Represents a function to retrieve details about a soundtrack associated with a soundtrack application.
     * The soundtrack has to be installed.
     * @param appId The ID of the soundtrack application.
     * @returns the details of the soundtrack associated with the specified soundtrack application.
     */
    GetSoundtrackDetails(appId: number): Promise<SoundtrackDetails>;
    GetStoreTagLocalization(tags: number[]): Promise<StoreTagLocalization[]>;
    /**
     * Retrieves a list of subscribed workshop item details for a specific application.
     * @param appId The ID of the application to retrieve subscribed workshop item details for.
     * @param itemIds Workshop item IDs to retrieve details for.
     * @returns an array of subscribed workshop item details for the specified application.
     * @throws Throws if the query failed.
     */
    GetSubscribedWorkshopItemDetails(appId: number, itemIds: string[]): Promise<WorkshopItem[] | OperationResponse>;
    /**
     * Retrieves a list of subscribed workshop items for a specific application.
     * @param appId The ID of the application to retrieve subscribed workshop items for.
     * @returns an array of subscribed workshop items for the specified application.
     */
    GetSubscribedWorkshopItems(appId: number): Promise<WorkshopItem[]>;
    InstallFlatpakAppAndCreateShortcut(appName: string, appCommandLineOptions: string): Promise<{
        appid: number;
        strInstallOutput: string;
    }>;
    /**
     * Join an app beta.
     * @param appId App ID of the beta to join.
     * @param name Beta name. Empty to opt out of betas.
     * @throws EResult if no beta found.
     */
    JoinAppContentBeta(appId: number, name: string): Promise<EResult>;
    /**
     * Join an app beta by password.
     * @throws EResult if no beta found.
     */
    JoinAppContentBetaByPassword(appId: number, accessCode: string): Promise<any>;
    ListFlatpakApps(): Promise<any>;
    /**
     * @throws if the user does not own the app or no EULA.
     */
    LoadEula(appId: number): Promise<EndUserLicenseAgreement[]>;
    MarkEulaAccepted(appId: number, id: string, version: number): void;
    MarkEulaRejected(appId: number, id: string, version: number): void;
    /**
     * Move specified workshop item load order.
     * @param appId The ID of the application.
     * @param oldOrder The item to move, referenced by its position number.
     * @param newOrder The position number to move the item to.
     * @remarks Orders are zero-indexed.
     */
    MoveWorkshopItemLoadOrder(appId: number, oldOrder: number, newOrder: number): void;
    /**
     * Opens the settings dialog for a specific application.
     * @param appId The ID of the application for which to open the settings dialog.
     * @param section The section (tab) to switch to.
     */
    OpenAppSettingsDialog(appId: number, section: string): void;
    /**
     * Raises the window for a given application.
     * @param appId The ID of the application to raise the window of.
     */
    RaiseWindowForGame(appId: number): Promise<ERaiseGameWindowResult>;
    /**
     * Registers a callback function to be called when achievement changes occur.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForAchievementChanges(callback: (data: ArrayBuffer) => void): Unregisterable;
    RegisterForAppBackupStatus(callback: (status: AppBackupStatus) => void): Unregisterable;
    /**
     * Registers a callback function to be called when app details change.
     * @param appId The ID of the application to monitor.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForAppDetails(appId: number, callback: (data: AppDetails) => void): Unregisterable;
    /**
     * If `data` is deserialized, returns {@link CAppOverview_Change}.
     * @remarks This is not a mistake, it doesn't return anything.
     */
    RegisterForAppOverviewChanges(callback: (data: ArrayBuffer) => void): void;
    RegisterForDRMFailureResponse(callback: (appid: number, eResult: EResult, errorCode: number) => void): Unregisterable;
    /**
     * Registers a callback function to be called when a game action ends.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForGameActionEnd(callback: (gameActionId: number) => void): Unregisterable;
    RegisterForGameActionShowError(callback: (gameActionId: number, appId: string, actionName: string, 
    /**
     * Localization token.
     */
    error: string, param4: string) => void): Unregisterable;
    /**
     * Registers a callback function to be called when a game action UI is shown.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForGameActionShowUI(callback: () => void): Unregisterable;
    /**
     * Registers a callback function to be called when a game action starts.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForGameActionStart(callback: (gameActionId: number, appId: string, action: string, param3: ELaunchSource) => void): Unregisterable;
    /**
     * Registers a callback function to be called when a game action task changes.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForGameActionTaskChange(callback: (gameActionId: number, appId: string, action: string, requestedAction: string, param4: string) => void): Unregisterable;
    /**
     * Registers a callback function to be called when a user requests a game action.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForGameActionUserRequest(callback: (gameActionId: number, appId: string, action: string, requestedAction: string, appId2: string) => void): Unregisterable;
    RegisterForPrePurchasedAppChanges(callback: () => void): Unregisterable;
    RegisterForShowMarketingMessageDialog: Unregisterable;
    /**
     * Registers a callback function to be notified when workshop items are added or removed from a Steam application.
     * @param callback The callback function to be called.
     * @returns an object that can be used to unregister the callback.
     */
    RegisterForWorkshopChanges(callback: (appId: number) => void): Unregisterable;
    RegisterForWorkshopItemDownloads(appId: number, callback: (appId: number, publishedFileId: string, param2: number) => void): Unregisterable;
    RegisterForWorkshopItemInstalled(callback: (item: InstalledWorkshopItem) => void): Unregisterable;
    /**
     * Removes a non-Steam application shortcut from the Steam library.
     * @param appId The ID of the application for which to remove the shortcut.
     */
    RemoveShortcut(appId: number): void;
    ReportLibraryAssetCacheMiss(appId: number, assetType: ELibraryAssetType): void;
    ReportMarketingMessageDialogShown(): void;
    RequestIconDataForApp(appId: number): void;
    RequestLegacyCDKeysForApp(appId: number): void;
    /**
     * Runs a game with specified parameters. Focuses the game if already launched.
     * @param appId The ID of the application to run.
     * @param launchOptions Additional launch options for the application.
     * @param param2 Additional parameter (exact usage may vary).
     * @param launchSource
     * @remarks `launchOptions` is appended before the ones specified in the application's settings.
     */
    RunGame(appId: string, launchOptions: string, param2: number, launchSource: ELaunchSource): void;
    SaveAchievementProgressCache(progress: string): Promise<void>;
    /**
     * Scans the system for installed non-Steam applications.
     * @returns an array of NonSteamApp objects representing installed non-Steam applications.
     * @remarks This function scans the user's system for installed applications that are not part of the Steam library. It does not scan for shortcuts added to the Steam library.
     *
     * On Linux, it scans inside /usr/share/applications and $XDG_DATA_HOME/applications.
     */
    ScanForInstalledNonSteamApps(): Promise<NonSteamApp[]>;
    /**
     * Sets the automatic update behavior for a Steam application.
     * @param appId The ID of the application to set the update behavior for.
     * @param mode The update behavior mode to set.
     * @remarks This function only works with installed Steam applications.
     */
    SetAppAutoUpdateBehavior(appId: number, mode: EAppAutoUpdateBehavior): void;
    /**
     * Sets the background downloads behavior for a specific Steam application.
     * @param appId The ID of the application to set the background downloads behavior for.
     * @param mode The background downloads mode to set.
     * @remarks This function only works with installed Steam applications.
     */
    SetAppBackgroundDownloadsBehavior(appId: number, mode: EAppAllowDownloadsWhileRunningBehavior): void;
    /**
     * Sets the current language for a specific Steam application.
     * @param appId The ID of the application to set the current language for.
     * @param language The language to set, represented as a language (e.g., "english", "spanish", "tchinese", "schinese").
     */
    SetAppCurrentLanguage(appId: number, language: string): void;
    /**
     * Sets the blocked state for apps.
     * @param appIds An array of app IDs to set the blocked state for.
     * @param state The state to set (true for blocked, false for unblocked).
     */
    SetAppFamilyBlockedState(appIds: number[], state: boolean): void;
    /**
     * Sets launch options for a Steam application.
     * @param appId The ID of the application to set launch options for.
     * @param launchOptions The launch options to be set for the application.
     */
    SetAppLaunchOptions(appId: number, launchOptions: string): void;
    /**
     * Sets a resolution override for a Steam application.
     * @param appId The ID of the application to set the resolution override for.
     * @param resolution The resolution to be set for the application. It can be "Default", "Native", or other compatible resolutions for the user's monitor.
     */
    SetAppResolutionOverride(appId: number, resolution: string): void;
    /**
     * Sets cached details for a specific application.
     * @param appId The ID of the application.
     * @param details The details to be cached, a stringified object.
     * @returns A Promise that resolves when the details are successfully cached.
     */
    SetCachedAppDetails(appId: number, details: string): Promise<void>;
    SetControllerRumblePreference(appId: number, value: EControllerRumbleSetting): void;
    /**
     * Sets the custom artwork for a given application.
     * @param appId The ID of the application to set custom artwork for.
     * @param base64 Base64 encoded image.
     * @param assetType The type of artwork to set.
     * @returns A Promise that resolves after the custom artwork is set.
     */
    SetCustomArtworkForApp(appId: number, base64: string, imageType: 'jpg' | 'png', assetType: ELibraryAssetType): Promise<void>;
    /**
     * Sets a custom logo position for a specific app.
     * @param appId The ID of the application.
     * @param details The details of the custom logo position, expected to be a stringified {@link LogoPositionForApp} object.
     * @returns A Promise that resolves when the custom logo position is successfully set.
     */
    SetCustomLogoPositionForApp(appId: number, details: string): Promise<void>;
    /**
     * Sets the enabled state for downloadable content (DLC) of a specific app.
     * @param appId The ID of the parent application.
     * @param appDLCId The ID of the DLC to set the state for.
     * @param value The value to set (true for enabled, false for disabled).
     */
    SetDLCEnabled(appId: number, appDLCId: number, value: boolean): void;
    /**
     * Set a local screenshot's caption.
     * @param appId The application ID the screenshot belongs to.
     * @param hHandle The handle of the screenshot.
     * @param caption
     */
    SetLocalScreenshotCaption(appId: string, hHandle: number, caption: string): void;
    /**
     * Set a local screenshot's privacy state.
     * @param appId The application ID the screenshot belongs to.
     * @param hHandle The handle of the screenshot.
     * @param privacy Screenshot privacy state.
     */
    SetLocalScreenshotPrivacy(appId: string, hHandle: number, privacy: EUCMFilePrivacyState): void;
    /**
     * Set a local screenshot's spoiler state.
     * @param appId The application ID the screenshot belongs to.
     * @param hHandle The handle of the screenshot.
     * @param spoilered Is the screenshot spoilered?
     */
    SetLocalScreenshotSpoiler(appId: string, hHandle: number, spoilered: boolean): void;
    /**
     * Sets the executable path for a non-Steam application shortcut.
     * @param appId The ID of the application to set the shortcut executable for.
     * @param path The path to the executable.
     */
    SetShortcutExe(appId: number, path: string): void;
    /**
     * Sets the icon for a non-Steam application shortcut.
     * @param appId The ID of the application to set the shortcut icon for.
     * @param path The path to the icon image (can be png or tga format).
     */
    SetShortcutIcon(appId: number, path: string): void;
    /**
     * Sets whether a non-Steam application shortcut should be included in the VR library.
     * @param appId The ID of the application to set the VR status for.
     * @param value A boolean indicating whether the application should be included in the VR library.
     */
    SetShortcutIsVR(appId: number, value: boolean): void;
    /**
     * Sets launch options for a non-Steam application shortcut.
     * @param appId The ID of the application to set the launch options for.
     * @param options The launch options to be used when starting the application.
     */
    SetShortcutLaunchOptions(appId: number, options: string): void;
    /**
     * Sets the name for a non-Steam application shortcut.
     * @param appId The ID of the application to set the shortcut name for.
     * @param name The name to be displayed for the application shortcut.
     */
    SetShortcutName(appId: number, name: string): void;
    /**
     * Sets the starting directory for a non-Steam application shortcut.
     * @param appId The ID of the application to set the starting directory for.
     * @param directory The directory from which the application should be launched.
     */
    SetShortcutStartDir(appId: number, directory: string): void;
    /**
     * Sets the client ID for streaming for a specific application.
     * @param appId The ID of the application.
     * @param clientId The client ID for streaming.
     */
    SetStreamingClientForApp(appId: number, clientId: string): void;
    SetThirdPartyControllerConfiguration(appId: number, value: EThirdPartyControllerConfiguration): void;
    /**
     * Sets the workshop items disabled state.
     * @param appId The ID of the application.
     * @param itemIds Workshop item IDs to change the state for.
     * @param value `true` to disable, `false` otherwise.
     */
    SetWorkshopItemsDisabledLocally(appId: number, itemIds: string[], value: boolean): void;
    /**
     * Sets the workshop items load order for a specified application.
     * @param appId The ID of the application.
     * @param itemIds Workshop item IDs. Has to be the full list of subscribed items, otherwise the specified items get moved to the last position.
     */
    SetWorkshopItemsLoadOrder(appId: number, itemIds: string[]): void;
    /**
     * Opens the controller configurator for a specific application.
     * @param appId The ID of the application for which to open the controller configurator.
     */
    ShowControllerConfigurator(appId: number): void;
    /**
     * Opens the Steam store page for a specific application.
     * @param appId The ID of the application.
     */
    ShowStore(appId: number): void;
    SpecifyCompatExperiment(appId: number, param1: string): void;
    /**
     * Specifies a compatibility tool by its name for a given application. If strToolName is an empty string, the specified application will no longer use a compatibility tool.
     * @param appId The ID of the application to specify compatibility tool for.
     * @param strToolName The name of the compatibility tool to specify.
     */
    SpecifyCompatTool(appId: number, strToolName: string): void;
    StreamGame(appId: number, clientId: string, param2: number): void;
    /**
     * Subscribes or unsubscribes from a workshop item for a specific app.
     * @param appId The ID of the application.
     * @param workshopId The ID of the workshop item.
     * @param subscribed True to subscribe, false to unsubscribe.
     */
    SubscribeWorkshopItem(appId: number, workshopId: string, subscribed: boolean): void;
    /**
     * Terminates a running application.
     * @param appId The ID of the application to terminate.
     * @param param1 Additional parameter. Exact usage may vary.
     */
    TerminateApp(appId: string, param1: boolean): void;
    ToggleAllowDesktopConfiguration(appId: number): void;
    /**
     * Toggles the Steam Cloud synchronization for game saves for a specific application.
     * @param appId The ID of the application.
     * @remarks This function modifies the "<STEAMPATH>/userdata/<STEAMID3>/7/remote/sharedconfig.vdf" file.
     */
    ToggleAppSteamCloudEnabled(appId: number): void;
    ToggleAppSteamCloudSyncOnSuspendEnabled(appId: number): void;
    /**
     * Toggles the Steam Overlay setting for a specific application.
     * @param appId The ID of the application.
     */
    ToggleEnableSteamOverlayForApp(appId: number): void;
    ToggleOverrideResolutionForInternalDisplay(appId: number): void;
    UninstallFlatpakApp(app: string): Promise<boolean>;
    /**
     * Verifies the integrity of an app's files.
     * @param appId The ID of the app to verify.
     */
    VerifyApp(appId: number): Promise<{
        nGameActionID: number;
    }>;
}
export declare enum ELibraryAssetType {
    Capsule = 0,
    Hero = 1,
    Logo = 2,
    Header = 3,
    Icon = 4,
    HeroBlur = 5
}
export interface AppAchievements {
    nAchieved: number;
    nTotal: number;
    vecAchievedHidden: AppAchievement[];
    vecHighlight: AppAchievement[];
    vecUnachieved: AppAchievement[];
}
export interface AppAchievement {
    bAchieved: boolean;
    /** Is it a hidden achievement before unlocking it? */
    bHidden: boolean;
    flMinProgress: number;
    flCurrentProgress: number;
    flMaxProgress: number;
    /** How many players have this achievement, in 0-100 range. */
    flAchieved: number;
    /** When this achievement was unlocked. */
    rtUnlocked: number;
    /** Localized achievement description. */
    strDescription: string;
    /** Achievement ID. */
    strID: string;
    /** Achievement icon. */
    strImage: string;
    /** Localized achievement name. */
    strName: string;
}
export type AppAction_t = 'LaunchApp' | 'VerifyApp';
export type LaunchAppTask_t = 'None' | 'Completed' | 'Cancelled' | 'Failed' | 'Starting' | 'ConnectingToSteam' | 'RequestingLicense' | 'UpdatingAppInfo' | 'UpdatingAppTicket' | 'UnlockingH264' | 'WaitingOnWideVineUpdate' | 'ShowCheckSystem' | 'CheckTimedTrial' | 'GetDurationControl' | 'ShowDurationControl' | 'ShowLaunchOption' | 'ShowEula' | 'ShowVR2DWarning' | 'ShowVROculusOnly' | 'ShowVRStreamingLaunch' | 'ShowGameArgs' | 'ShowCDKey' | 'WaitingPrevProcess' | 'DownloadingDepots' | 'DownloadingWorkshop' | 'UpdatingDRM' | 'GettingLegacyKey' | 'ProcessingInstallScript' | 'RunningInstallScript' | 'SynchronizingCloud' | 'SynchronizingControllerConfig' | 'ShowNoControllerConfig' | 'ProcessingShaderCache' | 'VerifyingFiles' | 'KickingOtherSession' | 'WaitingOpenVRAppQuit' | 'SiteLicenseSeatCheckout' | 'DelayLaunch' | 'CreatingProcess' | 'WaitingGameWindow';
export interface GameAction {
    nGameActionID: number;
    gameid: string;
    strActionName: AppAction_t;
    strTaskName: LaunchAppTask_t;
    strTaskDetails: string;
    nLaunchOption: number;
    nSecondsRemaing: number;
    strNumDone: string;
    strNumTotal: string;
    bWaitingForUI: boolean;
}
export interface ConflictingFileTimestamp {
    rtLocalTime: number;
    rtRemoteTime: number;
}
/**
 * Represents information about a compatibility tool.
 */
export interface CompatibilityTool {
    /** Name of the compatibility tool. */
    strToolName: string;
    /** Display name of the compatibility tool. */
    strDisplayName: string;
}
/**
 * Represents details about a single screenshot upload.
 */
export interface ScreenshotUploadDetails {
    /**
     * The size of the screenshot upload on disk (including thumbnail).
     */
    strSizeOnDisk: string;
    /**
     * The amount of cloud storage available.
     */
    strCloudAvailable: string;
    /**
     * The total cloud storage.
     */
    strCloudTotal: string;
}
/**
 * Represents details about multiple screenshot uploads.
 */
export interface ScreenshotUploadsDetails {
    /**
     * The total size of all screenshot uploads on disk (sum of sizes including thumbnails).
     */
    unSizeOnDisk: number;
    /**
     * The amount of cloud storage available.
     */
    strCloudAvailable: string;
    /**
     * The total cloud storage.
     */
    strCloudTotal: string;
}
interface InstalledWorkshopItem {
    appid: number;
    legacy_content: string;
    manifestid: string;
    publishedfileid: string;
}
export interface WorkshopItem {
    unAppID: number;
    ulPublishedFileID: string;
}
export interface AppAchievementData {
    rgAchievements: AppAchievement[];
}
export interface AppAchievementResponse {
    result: EResult;
    data: AppAchievementData;
}
export interface LaunchOption {
    bIsLaunchOptionTypeExemptFromGameTheater: VDFBoolean_t;
    bIsVRLaunchOption: VDFBoolean_t;
    eType: EAppLaunchOptionType;
    nIndex: number;
    /**
     * @note May be a localization string.
     */
    strDescription: string;
    strGameName: string;
}
/**
 * Represents playtime information for an application.
 */
export interface Playtime {
    /** Total playtime in minutes for the last 2 weeks. */
    nPlaytimeLastTwoWeeks: number;
    /** Total playtime in minutes. */
    nPlaytimeForever: number;
    /** Last played time in Unix Epoch time format. */
    rtLastTimePlayed: number;
}
export interface PrePurchaseApp {
    nAppID: number;
    eState: EAppReleaseState;
}
export interface PrePurchaseInfo {
    apps: PrePurchaseApp[];
    lastChangeNumber: number;
}
export declare enum EAppReleaseState {
    Unknown = 0,
    Unavailable = 1,
    Prerelease = 2,
    PreloadOnly = 3,
    Released = 4,
    Disabled = 5
}
export declare enum EAppLaunchOptionType {
    None = 0,
    Default = 1,
    SafeMode = 2,
    Multiplayer = 3,
    Config = 4,
    OpenVR = 5,
    Server = 6,
    Editor = 7,
    Manual = 8,
    Benchmark = 9,
    Option1 = 10,
    Option2 = 11,
    Option3 = 12,
    OculusVR = 13,
    OpenVROverlay = 14,
    OSVR = 15,
    OpenXR = 16,
    Dialog = 1000
}
export interface SoundtrackDetails {
    tracks: SoundtrackTrack[];
    metadata: SoundtrackMetadata;
    vecAdditionalImageAssetURLs: string[];
    strCoverImageAssetURL: string;
}
export interface SoundtrackTrack {
    discNumber: number;
    trackNumber: number;
    durationSeconds: number;
    trackDisplayName: string;
}
export interface SoundtrackMetadata {
    artist: string;
}
export interface StoreTagLocalization {
    tag: number;
    string: string;
}
export interface WorkshopItem {
    /**
     * Required items' IDs.
     */
    children: string[];
    eresult: EResult;
    /**
     * Item size, in byts.
     */
    file_size: string;
    /**
     * Workshop file type.
     */
    file_type: EWorkshopFileType;
    /**
     * Item preview image URL.
     */
    preview_url: string;
    /**
     * Item ID.
     */
    publishedfileid: string;
    /**
     * Item description.
     */
    short_description: string;
    /**
     * Item tags.
     */
    tags: string[];
    /**
     * Item title.
     */
    title: string;
}
export declare enum EWorkshopFileType {
    Invalid = -1,
    Community = 0,
    Microtransaction = 1,
    Collection = 2,
    Art = 3,
    Video = 4,
    Screenshot = 5,
    Game = 6,
    Software = 7,
    Concept = 8,
    WebGuide = 9,
    IntegratedGuide = 10,
    Merch = 11,
    ControllerBinding = 12,
    SteamworksAccessInvite = 13,
    SteamVideo = 14,
    GameManagedItem = 15,
    Max = 16
}
export interface EndUserLicenseAgreement {
    id: string;
    url: string;
    version: number;
}
export interface AppBackupStatus {
    appid: number;
    eError: EAppUpdateError;
    strBytesToProcess: string;
    strBytesProcessed: string;
    strTotalBytesWritten: string;
}
export declare enum EAppUpdateError {
    None = 0,
    Unspecified = 1,
    Paused = 2,
    Canceled = 3,
    Suspended = 4,
    NoSubscription = 5,
    NoConnection = 6,
    Timeout = 7,
    MissingKey = 8,
    MissingConfig = 9,
    DiskReadFailure = 10,
    DiskWriteFailure = 11,
    NotEnoughDiskSpace = 12,
    CorruptGameFiles = 13,
    WaitingForNextDisk = 14,
    InvalidInstallPath = 15,
    AppRunning = 16,
    DependencyFailure = 17,
    NotInstalled = 18,
    UpdateRequired = 19,
    Busy = 20,
    NoDownloadSources = 21,
    InvalidAppConfig = 22,
    InvalidDepotConfig = 23,
    MissingManifest = 24,
    NotReleased = 25,
    RegionRestricted = 26,
    CorruptDepotCache = 27,
    MissingExecutable = 28,
    InvalidPlatform = 29,
    InvalidFileSystem = 30,
    CorruptUpdateFiles = 31,
    DownloadDisabled = 32,
    SharedLibraryLocked = 33,
    PendingLicense = 34,
    OtherSessionPlaying = 35,
    CorruptDownload = 36,
    CorruptDisk = 37,
    FilePermissions = 38,
    FileLocked = 39,
    MissingContent = 40,
    Requires64BitOS = 41,
    MissingUpdateFiles = 42,
    NotEnoughDiskQuota = 43,
    LockedSiteLicense = 44,
    ParentalControlBlocked = 45,
    CreateProcessFailure = 46,
    SteamClientOutdated = 47,
    PlaytimeExceeded = 48,
    CorruptFileSignature = 49,
    MissingInstalledFiles = 50,
    CompatibilityToolFailure = 51,
    UnmountedUninstallPath = 52,
    InvalidBackupPath = 53,
    InvalidPasscode = 54,
    ThirdPartyUpdater = 55,
    ParentalPlaytimeExceeded = 56,
    Max = 57
}
export declare enum ESteamInputController {
    PlayStation = 1,
    Xbox = 2,
    Generic = 4,
    NintendoSwitch = 8
}
type AppPlatform_t = 'windows' | 'osx' | 'linux';
export interface AppDetails {
    achievements: AppAchievements;
    /** Indicates whether the application is available on the store. */
    bAvailableContentOnStore: boolean;
    bCanMoveInstallFolder: boolean;
    bCloudAvailable: boolean;
    bCloudEnabledForAccount: boolean;
    bCloudEnabledForApp: boolean;
    bCloudSyncOnSuspendAvailable: boolean;
    bCloudSyncOnSuspendEnabled: boolean;
    /** Indicates whether the application has community market available. */
    bCommunityMarketPresence: boolean;
    bEnableAllowDesktopConfiguration: boolean;
    bFreeRemovableLicense: boolean;
    bHasAllLegacyCDKeys: boolean;
    bHasAnyLocalContent: boolean;
    bHasLockedPrivateBetas: boolean;
    bIsExcludedFromSharing: boolean;
    bIsSubscribedTo: boolean;
    bIsThirdPartyUpdater: boolean;
    bOverlayEnabled: boolean;
    bOverrideInternalResolution: boolean;
    bRequiresLegacyCDKey: boolean;
    bShortcutIsVR: boolean;
    bShowCDKeyInMenus: boolean;
    bShowControllerConfig: boolean;
    bSupportsCDKeyCopyToClipboard: boolean;
    bVRGameTheatreEnabled: boolean;
    bWorkshopVisible: boolean;
    deckDerivedProperties?: AppDeckDerivedProperties;
    /**
     * @see {@link EAppOwnershipFlags}
     */
    eAppOwnershipFlags: number;
    eAutoUpdateValue: EAppAutoUpdateBehavior;
    eBackgroundDownloads: EAppAllowDownloadsWhileRunningBehavior;
    eCloudStatus: EAppCloudStatus;
    /**
     * @todo enum
     */
    eCloudSync: number;
    eControllerRumblePreference: EControllerRumbleSetting;
    eDisplayStatus: EDisplayStatus;
    eEnableThirdPartyControllerConfiguration: EThirdPartyControllerConfiguration;
    /**
     * @see {@link ESteamInputController}
     */
    eSteamInputControllerMask: number;
    /**
     * Index of the install folder. -1 if not installed.
     */
    iInstallFolder: number;
    /** Disk space required for installation, in bytes. */
    lDiskSpaceRequiredBytes: number;
    /** Application disk space usage, in bytes. */
    lDiskUsageBytes: number;
    /** DLC disk space usage, in bytes. */
    lDlcUsageBytes: number;
    nBuildID: number;
    nCompatToolPriority: number;
    /** Total play time, in minutes. */
    nPlaytimeForever: number;
    /** Screenshot count. */
    nScreenshots: number;
    rtLastTimePlayed: number;
    rtLastUpdated: number;
    rtPurchased: number;
    selectedLanguage: AppLanguage;
    strCloudBytesAvailable: string;
    strCloudBytesUsed: string;
    strCompatToolDisplayName: string;
    strCompatToolName: string;
    strDeveloperName: string;
    strDeveloperURL: string;
    strDisplayName: string;
    strExternalSubscriptionURL: string;
    strFlatpakAppID: string;
    strHomepageURL: string;
    strLaunchOptions: string;
    strManualURL: string;
    /** Steam64 ID. */
    strOwnerSteamID: string;
    strResolutionOverride: string;
    strSelectedBeta: string;
    strShortcutExe: string;
    strShortcutLaunchOptions: string;
    strShortcutStartDir: string;
    strSteamDeckBlogURL: string;
    unAppID: number;
    unEntitledContentApp: number;
    unTimedTrialSecondsAllowed: number;
    unTimedTrialSecondsPlayed: number;
    vecBetas: AppBeta[];
    vecChildConfigApps: number[];
    vecDLC: AppDLC[];
    vecDeckCompatTestResults: DeckCompatTestResult[];
    vecLanguages: AppLanguage[];
    vecLegacyCDKeys: LegacyCDKey[];
    vecMusicAlbums: AppSoundtrack[];
    vecPlatforms: AppPlatform_t[];
    vecScreenShots: Screenshot[];
    libraryAssets?: AppLibraryAsset;
}
interface AppAssociation {
    strName: string;
    strURL: string;
}
export interface AppAssociations {
    rgDevelopers: AppAssociation[];
    rgFranchises: AppAssociation[];
    rgPublishers: AppAssociation[];
}
export interface BadgeCard {
    nOwned: number;
    strArtworkURL: string;
    strImgURL: string;
    strMarketHash: string;
    strName: string;
    strTitle: string;
}
export interface Badge {
    bMaxed: VDFBoolean_t;
    dtNextRetry: number | null;
    nLevel: number;
    nMaxLevel: number;
    nNextLevelXP: number;
    nXP: number;
    rgCards: BadgeCard[];
    strIconURL: string;
    strName: string;
    strNextLevelName: string;
}
interface AppDescription {
    /**
     * Full app description. Note that it uses BB code and so must be rendered.
     */
    strFullDescription: string;
    /**
     * Short game description.
     */
    strSnippet: string;
}
interface CachedAppDetailMap {
    /**
     * Stringified JSON data of achievements.
     */
    achievementmap: string;
    achievements: AppAchievements;
    associations: AppAssociations;
    badge: Badge;
    descriptions: AppDescription;
    gameactivity: any[];
    /**
     * Each string is a base64 encoded binary data.
     */
    usernews: string[];
    workshop_trendy_items: any;
}
export type CachedAppDetails = {
    [K in keyof CachedAppDetailMap]: {
        version: number;
        data: CachedAppDetailMap[K];
    };
};
export interface AppDeckDerivedProperties {
    gamescope_frame_limiter_not_supported?: boolean;
    non_deck_display_glyphs: boolean;
    primary_player_is_controller_slot_0: boolean;
    requires_h264: boolean;
    requires_internet_for_setup: boolean;
    requires_internet_for_singleplayer: boolean;
    requires_manual_keyboard_invoke: false;
    requires_non_controller_launcher_nav: false;
    small_text: boolean;
    supported_input: number;
}
export declare enum EAppOwnershipFlags {
    None = 0,
    Subscribed = 1,
    Free = 2,
    RegionRestricted = 4,
    LowViolence = 8,
    InvalidPlatform = 16,
    Borrowed = 32,
    FreeWeekend = 64,
    Retail = 128,
    Locked = 256,
    Pending = 512,
    Expired = 1024,
    Permanent = 2048,
    Recurring = 4096,
    Canceled = 8192,
    AutoGrant = 16384,
    PendingGift = 32768,
    RentalNotActivated = 65536,
    Rental = 131072,
    SiteLicense = 262144,
    LegacyFreeSub = 524288,
    InvalidOSType = 1048576,
    TimedTrial = 2097152
}
export declare enum EAppAutoUpdateBehavior {
    Always = 0,
    Launch = 1,
    HighPriority = 2
}
export declare enum EAppAllowDownloadsWhileRunningBehavior {
    UseGlobal = 0,
    AlwaysAllow = 1,
    NeverAllow = 2
}
export declare enum EDisplayStatus {
    Invalid = 0,
    Launching = 1,
    Uninstalling = 2,
    Installing = 3,
    Running = 4,
    Validating = 5,
    Updating = 6,
    Downloading = 7,
    Synchronizing = 8,
    ReadyToInstall = 9,
    ReadyToPreload = 10,
    ReadyToLaunch = 11,
    RegionRestricted = 12,
    PresaleOnly = 13,
    InvalidPlatform = 14,
    PreloadComplete = 16,
    BorrowerLocked = 17,
    UpdatePaused = 18,
    UpdateQueued = 19,
    UpdateRequired = 20,
    UpdateDisabled = 21,
    DownloadPaused = 22,
    DownloadQueued = 23,
    DownloadRequired = 24,
    DownloadDisabled = 25,
    LicensePending = 26,
    LicenseExpired = 27,
    AvailForFree = 28,
    AvailToBorrow = 29,
    AvailGuestPass = 30,
    Purchase = 31,
    Unavailable = 32,
    NotLaunchable = 33,
    CloudError = 34,
    CloudOutOfDate = 35,
    Terminating = 36,
    OwnerLocked = 37,
    DownloadFailed = 38,
    UpdateFailed = 39
}
export declare enum ESteamDeckCompatibilityTestResult {
    Invalid = 0,
    NotApplicable = 1,
    Pass = 2,
    Fail = 3,
    FailMinor = 4
}
export interface AppLanguage {
    strDisplayName: string;
    /** A localization string for the language. */
    strShortName: string;
}
export interface LegacyCDKey {
    eResult: EResult;
    strKey: string;
    strName: string;
}
export interface AppBeta {
    /** Beta name. */
    strName: string;
    /** Beta description. */
    strDescription: string;
}
export interface AppDLC {
    /** Is the DLC availble on the store? */
    bAvailableOnStore: boolean;
    bEnabled: boolean;
    /** Disk usage, in bytes. */
    lDiskUsageBytes: number;
    /** Purchase date. */
    rtPurchaseDate: number;
    rtStoreAssetModifyType: number;
    /** Store header image filename. */
    strHeaderFilename: string;
    /** Display name. */
    strName: string;
    /** State (installed/notinstalled). */
    strState: string;
    /** App ID. */
    unAppID: number;
}
export interface DeckCompatTestResult {
    test_result: ESteamDeckCompatibilityTestResult;
    /** A localization string. */
    test_loc_token: string;
}
export interface AppSoundtrack {
    /** Purchase date. */
    rtPurchaseDate: number;
    rtStoreAssetModifyType: number;
    /** Display name. */
    strName: string;
    /** State (installed/notinstalled). */
    strState: string;
    /** App ID. */
    unAppID: number;
}
export interface AppLibraryAsset {
    logoPosition?: LogoPosition;
    strCapsuleImage: string;
    strHeroBlurImage: string;
    strHeroImage: string;
    strLogoImage: string;
}
export interface LogoPosition {
    pinnedPosition: LogoPinPosition_t;
    nWidthPct: number;
    nHeightPct: number;
}
export type LogoPinPosition_t = 'BottomLeft' | 'UpperLeft' | 'CenterCenter' | 'UpperCenter' | 'BottomCenter';
export declare enum ELaunchSource {
    None = 0,
    _2ftLibraryDetails = 100,
    _2ftLibraryListView = 101,
    _2ftLibraryGrid = 102,
    InstallSubComplete = 103,
    DownloadsPage = 104,
    RemoteClientStartStreaming = 105,
    _2ftMiniModeList = 106,
    _10ft = 200,
    DashAppLaunchCmdLine = 300,
    DashGameIdLaunchCmdLine = 301,
    RunByGameDir = 302,
    SubCmdRunDashGame = 303,
    SteamURL_Launch = 400,
    SteamURL_Run = 401,
    SteamURL_JoinLobby = 402,
    SteamURL_RunGame = 403,
    SteamURL_RunGameIdOrJumplist = 404,
    SteamURL_RunSafe = 405,
    TrayIcon = 500,
    LibraryLeftColumnContextMenu = 600,
    LibraryLeftColumnDoubleClick = 601,
    Dota2Launcher = 700,
    IRunGameEngine = 800,
    DRMFailureResponse = 801,
    DRMDataRequest = 802,
    CloudFilePanel = 803,
    DiscoveredAlreadyRunning = 804,
    GameActionJoinParty = 900,
    AppPortraitContextMenu = 1000
}
export interface NonSteamApp {
    bIsApplication: boolean;
    strAppName: string;
    strExePath: string;
    strArguments: string;
    strCmdline: string;
    strIconDataBase64: string | undefined;
}
export interface Shortcut extends NonSteamApp {
    strShortcutPath: string | undefined;
    strSortAs: string | undefined;
}
export interface LogoPositionForApp {
    nVersion: number;
    logoPosition: LogoPosition;
}
export interface CLibraryBootstrapData extends JsPbMessage {
    app_data(): AppBootstrapData[];
    add_app_data(param0: any, param1: any): any;
    set_app_data(param0: any): any;
}
export interface AppBootstrapData {
    appid: number;
    hidden: boolean;
    user_tag: string[];
}
export interface CAppOverview_Change extends JsPbMessage {
    app_overview(): SteamAppOverview[];
    full_update(): boolean;
    removed_appid(): number[];
    update_complete(): boolean;
    add_app_overview(param0: any, param1: any): any;
    add_removed_appid(param0: any, param1: any): any;
    set_app_overview(param0: any): any;
    set_full_update(param0: any): any;
    set_removed_appid(param0: any): any;
    set_update_complete(param0: any): any;
}
export declare enum ECloudPendingRemoteOperation {
    None = 0,
    AppSessionActive = 1,
    UploadInProgress = 2,
    UploadPending = 3,
    AppSessionSuspended = 4
}
export interface CCloud_PendingRemoteOperation {
    operation(): ECloudPendingRemoteOperation;
    machine_name(): string;
    client_id(): number;
    time_last_updated(): number;
    os_type(): number;
    device_type(): number;
}
export interface CMsgCloudPendingRemoteOperations extends JsPbMessage {
    operations: CCloud_PendingRemoteOperation[];
}
export interface SteamAppOverview {
    appid: number;
    display_name: string;
    visible_in_game_list: boolean;
    sort_as: string;
    app_type: EAppType;
    mru_index: number | undefined;
    rt_recent_activity_time: number;
    minutes_playtime_forever: number;
    minutes_playtime_last_two_weeks: number;
    rt_last_time_played_or_installed: number;
    rt_last_time_played: number;
    store_tag?: number[];
    association: SteamAppOverviewAssociation[];
    store_category?: number[];
    rt_original_release_date: number;
    rt_steam_release_date: number;
    icon_hash: string;
    controller_support?: EAppControllerSupportLevel;
    vr_supported?: boolean;
    metacritic_score: number;
    size_on_disk?: number;
    third_party_mod?: boolean;
    icon_data?: string;
    icon_data_format?: string;
    gameid: string;
    library_capsule_filename?: string;
    per_client_data: SteamAppOverviewRemoteClientData[];
    most_available_clientid: string;
    selected_clientid?: string;
    rt_store_asset_mtime: number;
    rt_custom_image_mtime?: number;
    optional_parent_app_id?: number;
    owner_account_id?: number;
    review_score_with_bombs: number;
    review_percentage_with_bombs: number;
    review_score_without_bombs: number;
    review_percentage_without_bombs: number;
    library_id?: string;
    vr_only?: boolean;
    mastersub_appid?: number;
    mastersub_includedwith_logo?: string;
    site_license_site_name?: string;
    shortcut_override_appid?: number;
    steam_deck_compat_category: ESteamDeckCompatibilityCategory;
    rt_last_time_locally_played?: number;
    rt_purchased_time: number;
    header_filename?: string;
    local_cache_version?: number;
    ps4_controller_support?: EAppControllerSupportLevel;
    ps5_controller_support?: EAppControllerSupportLevel;
    gamepad_preferred?: boolean;
    canonicalAppType: number;
    local_per_client_data: SteamAppOverviewRemoteClientData;
    most_available_per_client_data: SteamAppOverviewRemoteClientData;
    selected_per_client_data: SteamAppOverviewRemoteClientData;
}
export declare enum EAppType {
    DepotOnly = -2147483648,
    Invalid = 0,
    Game = 1,
    Application = 2,
    Tool = 4,
    Demo = 8,
    Deprecated = 16,
    DLC = 32,
    Guide = 64,
    Driver = 128,
    Config = 256,
    Hardware = 512,
    Franchise = 1024,
    Video = 2048,
    Plugin = 4096,
    MusicAlbum = 8192,
    Series = 16384,
    Comic = 32768,
    Beta = 65536,
    Shortcut = 1073741824
}
export interface SteamAppOverviewAssociation {
    type: EAppAssociationType;
    name: string;
}
export declare enum EAppAssociationType {
    Invalid = 0,
    Publisher = 1,
    Developer = 2,
    Franchise = 3
}
export declare enum EAppControllerSupportLevel {
    None = 0,
    Partial = 1,
    Full = 2
}
export interface SteamAppOverviewRemoteClientData {
    clientid: string;
    client_name: string;
    display_status: EDisplayStatus;
    status_percentage: number;
    active_beta?: string;
    installed?: boolean;
    bytes_downloaded: string;
    bytes_total: string;
    streaming_to_local_client?: boolean;
    is_available_on_current_platform: boolean;
    is_invalid_os_type?: boolean;
    playtime_left?: number;
    cloud_status: EAppCloudStatus;
}
export declare enum ESteamDeckCompatibilityCategory {
    Unknown = 0,
    Unsupported = 1,
    Playable = 2,
    Verified = 3
}
export declare enum EAppCloudStatus {
    Invalid = 0,
    Disabled = 1,
    Unknown = 2,
    Synchronized = 3,
    Checking = 4,
    OutOfSync = 5,
    Uploading = 6,
    Downloading = 7,
    SyncFailed = 8,
    Conflict = 9,
    PendingElsewhere = 10
}
export declare enum ERaiseGameWindowResult {
    NotRunning = 1,
    Success = 2,
    Failure = 3
}
export {};
