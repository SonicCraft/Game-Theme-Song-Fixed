export declare enum EResult {
    OK = 1,
    Fail = 2,
    NoConnection = 3,
    InvalidPassword = 5,
    LoggedInElsewhere = 6,
    InvalidProtocolVer = 7,
    InvalidParam = 8,
    FileNotFound = 9,
    Busy = 10,
    InvalidState = 11,
    InvalidName = 12,
    InvalidEmail = 13,
    DuplicateName = 14,
    AccessDenied = 15,
    Timeout = 16,
    Banned = 17,
    AccountNotFound = 18,
    InvalidSteamID = 19,
    ServiceUnavailable = 20,
    NotLoggedOn = 21,
    Pending = 22,
    EncryptionFailure = 23,
    InsufficientPrivilege = 24,
    LimitExceeded = 25,
    Revoked = 26,
    Expired = 27,
    AlreadyRedeemed = 28,
    DuplicateRequest = 29,
    AlreadyOwned = 30,
    IPNotFound = 31,
    PersistFailed = 32,
    LockingFailed = 33,
    LogonSessionReplaced = 34,
    ConnectFailed = 35,
    HandshakeFailed = 36,
    IOFailure = 37,
    RemoteDisconnect = 38,
    ShoppingCartNotFound = 39,
    Blocked = 40,
    Ignored = 41,
    NoMatch = 42,
    AccountDisabled = 43,
    ServiceReadOnly = 44,
    AccountNotFeatured = 45,
    AdministratorOK = 46,
    ContentVersion = 47,
    TryAnotherCM = 48,
    PasswordRequiredToKickSession = 49,
    AlreadyLoggedInElsewhere = 50,
    Suspended = 51,
    Cancelled = 52,
    DataCorruption = 53,
    DiskFull = 54,
    RemoteCallFailed = 55,
    PasswordUnset = 56,
    ExternalAccountUnlinked = 57,
    PSNTicketInvalid = 58,
    ExternalAccountAlreadyLinked = 59,
    RemoteFileConflict = 60,
    IllegalPassword = 61,
    SameAsPreviousValue = 62,
    AccountLogonDenied = 63,
    CannotUseOldPassword = 64,
    InvalidLoginAuthCode = 65,
    AccountLogonDeniedNoMail = 66,
    HardwareNotCapableOfIPT = 67,
    IPTInitError = 68,
    ParentalControlRestricted = 69,
    FacebookQueryError = 70,
    ExpiredLoginAuthCode = 71,
    IPLoginRestrictionFailed = 72,
    AccountLockedDown = 73,
    AccountLogonDeniedVerifiedEmailRequired = 74,
    NoMatchingURL = 75,
    BadResponse = 76,
    RequirePasswordReEntry = 77,
    ValueOutOfRange = 78,
    UnexpectedError = 79,
    Disabled = 80,
    InvalidCEGSubmission = 81,
    RestrictedDevice = 82,
    RegionLocked = 83,
    RateLimitExceeded = 84,
    AccountLoginDeniedNeedTwoFactor = 85,
    ItemDeleted = 86,
    AccountLoginDeniedThrottle = 87,
    TwoFactorCodeMismatch = 88,
    TwoFactorActivationCodeMismatch = 89,
    AccountAssociatedToMultiplePartners = 90,
    NotModified = 91,
    NoMobileDevice = 92,
    TimeNotSynced = 93,
    SmsCodeFailed = 94,
    AccountLimitExceeded = 95,
    AccountActivityLimitExceeded = 96,
    PhoneActivityLimitExceeded = 97,
    RefundToWallet = 98,
    EmailSendFailure = 99,
    NotSettled = 100,
    NeedCaptcha = 101,
    GSLTDenied = 102,
    GSOwnerDenied = 103,
    InvalidItemType = 104,
    IPBanned = 105,
    GSLTExpired = 106,
    InsufficientFunds = 107,
    TooManyPending = 108,
    NoSiteLicensesFound = 109,
    WGNetworkSendExceeded = 110,
    AccountNotFriends = 111,
    LimitedUserAccount = 112
}
export declare enum EBrowserType {
    /**
     * No window is created (like SharedJSContext).
     */
    OffScreen = 0,
    OpenVROverlay = 1,
    OpenVROverlay_Dashboard = 2,
    /**
     * A normal window.
     */
    DirectHWND = 3,
    /**
     * A borderless window.
     */
    DirectHWND_Borderless = 4,
    /**
     * An initially hidden window.
     * May be shown with {@link SteamClient.Window.ShowWindow}.
     */
    DirectHWND_Hidden = 5,
    ChildHWNDNative = 6,
    Offscreen_SteamUI = 12,
    OpenVROverlay_Subview = 13
}
export declare enum ESteamRealm {
    Unknown = 0,
    Global = 1,
    China = 2
}
/**
 * Controls how Gamescope renders the GamepadUI window when a game is running.
 */
export declare enum EUIComposition {
    /** Steam is not rendered on the screen. */
    Hidden = 0,
    /**
     * Transparent divs will allow pixels from the app behind Steam to penetrate.
     * Input goes to **the app**.
     */
    Notification = 1,
    /**
     * Transparent divs will allow pixels from the app behind Steam to penetrate.
     * Input goes to **Steam**.
     */
    Overlay = 2,
    /** Take all of the pixels on the screen, nothing "behind" Steam is shown. */
    Opaque = 3,
    /**
     * Special composition mode that matches {@link Overlay}, but forwards synthetic keyboard
     * events to the Gamescope foreground app (game) instead of Steam.
     */
    OverlayKeyboard = 4
}
export declare enum EUIMode {
    Unknown = -1,
    GamePad = 4,
    Desktop = 7
}
/** 0 - false, 1 - true */
export type VDFBoolean_t = 0 | 1;
export interface BrowserContext {
    /**
     * Window type.
     */
    m_eBrowserType?: EBrowserType;
    /**
     * The UI mode in use.
     */
    m_eUIMode?: EUIMode;
    /**
     * @todo Appears when {@link m_eBrowserType} == 0 ?
     */
    m_gameID?: string;
    /**
     * @todo Same as `SteamClient.Browser.GetBrowserID()` ?
     */
    m_nBrowserID: number;
    /**
     * Game's app ID.
     */
    m_unAppID?: number;
    /**
     * If overlay, game's PID.
     */
    m_unPID: number;
}
/**
 * Represents the response of an operation. It appears to be not necessary to await for this operation response. It is only used to indicate the result of an operation.
 */
export interface OperationResponse {
    /**
     * The result code of the operation.
     */
    result: EResult;
    /**
     * An unlocalized message describing the result of the operation.
     */
    message: string;
}
export interface Unregisterable {
    /**
     * Unregister the callback.
     */
    unregister(): void;
}
/**
 * ProtoBuf message class.
 */
export interface JsPbMessageClass {
    /**
     * @todo Returns {@link JsPbMessage}, but not sure how to do it for the messages.
     */
    deserializeBinary(data: ArrayBuffer): any;
}
/**
 * Deserialized ProtoBuf message.
 */
export interface JsPbMessage {
    getClassName(): string;
    serializeBase64String(): string;
    serializeBinary(): Uint8Array;
    /**
     * Converts the message to an object.
     */
    toObject(includeJsPbInstance: boolean): any;
}
