if type(jit) == "table" and type(jit.off) == "function" then
    pcall(jit.off)
    pcall(jit.flush)
end
local logger     = require("logger")
local millennium = require("millennium")
local json       = require("json")
local ok_fs, fs = pcall(require, "fs"); if not ok_fs then fs = nil end
local ok_utils, utils = pcall(require, "utils"); if not ok_utils then utils = nil end
local ok_http, http = pcall(require, "http"); if not ok_http then http = nil end

collectgarbage("setpause", 120)
collectgarbage("setstepmul", 300)

local function resolve_plugin_dir()
    local source = debug.getinfo(1, "S").source or ""
    if source:sub(1, 1) == "@" then source = source:sub(2) end
    local dir = source:match("^(.+)[/\\]backend[/\\][^/\\]+$")
    if dir then return dir end
    return millennium.steam_path() .. "/millennium/plugins/Game Theme Song on Game Page"
end

local SEP = package.config:sub(1, 1)

local function norm_path(p)
    p = tostring(p)
    if SEP == "\\" then
        p = p:gsub("/", "\\")
        return (p:gsub("\\+$", ""))
    end
    p = p:gsub("\\", "/")
    return (p:gsub("(.)/+$", "%1"))
end

local function join(...)
    return table.concat({ ... }, SEP)
end

local PLUGIN_DIR = norm_path(resolve_plugin_dir())

local function resolve_data_dir()
    local install = millennium.get_install_path() or ""
    install = install:gsub("/", SEP):gsub(SEP .. "+$", "")
    return install .. SEP .. "plugins" .. SEP .. "game-theme-song-data"
end

local DATA_DIR = norm_path(resolve_data_dir())

local function ensure_data_dir()
    if not fs then return end
    if fs.exists(DATA_DIR) then return end
    pcall(fs.create_directories, DATA_DIR)
end

local function migrate_data_file(name)
    local src = join(PLUGIN_DIR, name)
    local dst = join(DATA_DIR, name)
    if fs and fs.exists(dst) then return end
    local f = io.open(src, "rb")
    if not f then return end
    local content = f:read("*a")
    f:close()
    if content and content ~= "" then
        local out = io.open(dst, "wb")
        if out then out:write(content); out:close() end
    end
end

local function migrate_all_data()
    ensure_data_dir()
    migrate_data_file("settings.json")
    migrate_data_file("cache.json")
    migrate_data_file("custom.json")
    migrate_data_file("ignored.json")
end

local CACHE_FILE = join(DATA_DIR, "cache.json")
local CONFIG_FILE = join(DATA_DIR, "settings.json")
local CUSTOM_FILE = join(DATA_DIR, "custom.json")
local IGNORE_FILE = join(DATA_DIR, "ignored.json")
local RESOLVE_MARKER = join(DATA_DIR, "resolve.lock")
local BOOT_MARKER = join(DATA_DIR, "boot.lock")
local AUDIO_DIR = join(norm_path(millennium.steam_path()), "steamui", "game_theme_song")
local CUSTOM_BACKUP_DIR = norm_path(join(norm_path(millennium.steam_path()), "millennium", "game-theme-song-custom"))
-- v21.4.2: persistent automatic downloads, deliberately outside steamui.
local AUTO_BACKUP_DIR = norm_path(join(norm_path(millennium.steam_path()), "millennium", "game-theme-song-auto-cache"))
local AUTO_TRACK_DIR = join(AUTO_BACKUP_DIR, "tracks")
local AUTO_INDEX_FILE = join(AUTO_BACKUP_DIR, "cache.json")
local AUTO_PREVIOUS_INDEX_FILE = join(AUTO_BACKUP_DIR, "cache.previous.json")
local CUSTOM_BACKUP_FILE = join(CUSTOM_BACKUP_DIR, "custom.json")
local LOOPBACK_BASE = "https://steamloopback.host/game_theme_song/"
local CONFIG_VERSION = 14

local DEFAULT_SETTINGS = {
    config_version = CONFIG_VERSION,
    enabled = true,
    volume = 0.35,
    volume_overrides = {},
    fade_seconds = 1.5,
    search_suffix = " theme song",
    loop = true,
    max_seconds = 0,
    stop_on_launch = true,
    manual_search = false,
    confirm_before_download = false,
    fallback_file = "",
    fallback_title = "",
    fallback_ts = 0,
    localized = true,
}

local cache = {}
local settings = {}
local custom = {}

local MAX_JSON_BYTES = 1 * 1024 * 1024
local MAX_JSON_DEPTH = 32
local MAX_HTTP_BYTES = 3 * 1024 * 1024
local MAX_TITLE_LEN = 200
local MAX_LIST_ITEMS = 500

local function utf8_find_invalid(s, start)
    local i, n = start or 1, #s
    local byte = string.byte
    while i <= n do
        local c = byte(s, i)
        if c < 0x80 then
            i = i + 1
        elseif c >= 0xC2 and c <= 0xDF then
            local c2 = byte(s, i + 1)
            if not c2 or c2 < 0x80 or c2 > 0xBF then return i end
            i = i + 2
        elseif c >= 0xE0 and c <= 0xEF then
            local c2, c3 = byte(s, i + 1), byte(s, i + 2)
            if not c3 or c2 < 0x80 or c2 > 0xBF or c3 < 0x80 or c3 > 0xBF
                or (c == 0xE0 and c2 < 0xA0) or (c == 0xED and c2 >= 0xA0) then
                return i
            end
            i = i + 3
        elseif c >= 0xF0 and c <= 0xF4 then
            local c2, c3, c4 = byte(s, i + 1), byte(s, i + 2), byte(s, i + 3)
            if not c4 or c2 < 0x80 or c2 > 0xBF or c3 < 0x80 or c3 > 0xBF
                or c4 < 0x80 or c4 > 0xBF
                or (c == 0xF0 and c2 < 0x90) or (c == 0xF4 and c2 > 0x8F) then
                return i
            end
            i = i + 4
        else
            return i
        end
    end
    return nil
end

local function to_valid_utf8(s)
    if type(s) ~= "string" then return s end
    local bad = utf8_find_invalid(s, 1)
    if not bad then return s end
    local out, pos, n = {}, 1, #s
    local repl = "\239\191\189"
    while bad do
        if bad > pos then out[#out + 1] = s:sub(pos, bad - 1) end
        out[#out + 1] = repl
        pos = bad + 1
        if pos > n then
            bad = nil
        else
            bad = utf8_find_invalid(s, pos)
        end
    end
    if pos <= n then out[#out + 1] = s:sub(pos) end
    return table.concat(out)
end

local function sanitize_text(s, max_len)
    s = to_valid_utf8(tostring(s or "")):gsub("[%z\1-\8\11\12\14-\31\127]", "")
    max_len = max_len or MAX_TITLE_LEN
    if #s > max_len then s = s:sub(1, max_len) end
    return s
end

local function cap_body(body)
    if type(body) == "string" and #body > MAX_HTTP_BYTES then
        return body:sub(1, MAX_HTTP_BYTES)
    end
    return body
end

local function json_safe_to_decode(str, max_depth)
    if type(str) ~= "string" then return false end
    local n = #str
    if n == 0 or n > MAX_JSON_BYTES then return false end
    local i = 1
    while i <= n do
        local c = str:byte(i)
        if c == 32 or c == 9 or c == 10 or c == 13 then i = i + 1 else break end
    end
    if i > n then return false end
    local first = str:byte(i)
    if first ~= 123 and first ~= 91 then return false end
    local depth, in_str = 0, false
    while i <= n do
        local c = str:byte(i)
        if in_str then
            if c == 92 then i = i + 1
            elseif c == 34 then in_str = false end
        elseif c == 34 then in_str = true
        elseif c == 123 or c == 91 then
            depth = depth + 1
            if depth > max_depth then return false end
        elseif c == 125 or c == 93 then
            depth = depth - 1
            if depth < 0 then return false end
        end
        i = i + 1
    end
    if in_str or depth ~= 0 then return false end
    return true
end

local function presanitize_json(str)
    str = to_valid_utf8(str)
    if str:find("\\[uU][dD][89aAbBcCdDeEfF]%x%x") then
        str = str:gsub("\\[uU][dD][89aAbBcCdDeEfF]%x%x", "\\uFFFD")
    end
    return str
end

local raw_json_decode = json.decode

local function safe_decode(str)
    if not str or str == "" then return nil end
    str = presanitize_json(str)
    if not json_safe_to_decode(str, MAX_JSON_DEPTH) then
        return nil
    end
    local ok, val = pcall(raw_json_decode, str)
    if not ok then
        return nil
    end
    return val
end

local function safe_encode(val)
    local ok, res = pcall(json.encode, val)
    if not ok then
        return nil
    end
    return res
end

local gts_unpack = table.unpack or unpack

local function deep_safe(v, depth)
    local t = type(v)
    if t == "string" then
        return (to_valid_utf8(v):gsub("%z", ""))
    elseif t == "number" then
        if v ~= v or v == math.huge or v == -math.huge then return 0 end
        return v
    elseif t == "boolean" then
        return v
    elseif t == "table" then
        if depth >= MAX_JSON_DEPTH then return nil end
        local out = {}
        for k, val in pairs(v) do
            local kt = type(k)
            local nk = nil
            if kt == "string" then nk = (to_valid_utf8(k):gsub("%z", ""))
            elseif kt == "number" then if k == k and k ~= math.huge and k ~= -math.huge then nk = k end end
            if nk ~= nil then
                local nv = deep_safe(val, depth + 1)
                if nv ~= nil then out[nk] = nv end
            end
        end
        return out
    end
    return nil
end

local function native_string(s, max)
    s = to_valid_utf8(tostring(s)):gsub("%z", "")
    if max and #s > max then s = s:sub(1, max) end
    return s
end

local function native_url(u)
    u = to_valid_utf8(tostring(u)):gsub("[%z\1-\31\127]", "")
    if #u > 4096 then u = u:sub(1, 4096) end
    return u
end

do
    local _encode = json.encode
    json.encode = function(v) return _encode(deep_safe(v, 0)) end
    json.decode = function(s)
        if type(s) == "string" then s = presanitize_json(s) end
        return raw_json_decode(s)
    end
end

if http then
    if type(http.request) == "function" then
        local _r = http.request
        http.request = function(url, opts) return _r(native_url(url), opts) end
    end
    if type(http.download) == "function" then
        local _d = http.download
        http.download = function(url, path, opts) return _d(native_url(url), native_string(path), opts) end
    end
end

if fs then
    local function wrap_path1(name)
        if type(fs[name]) == "function" then
            local orig = fs[name]
            fs[name] = function(p, ...) return orig(native_string(p), ...) end
        end
    end
    wrap_path1("list"); wrap_path1("exists"); wrap_path1("remove"); wrap_path1("create_directories")
    if type(fs.copy) == "function" then
        local _c = fs.copy
        fs.copy = function(a, b, ...) return _c(native_string(a), native_string(b), ...) end
    end
end

if type(logger) == "table" then
    for _, m in ipairs({ "info", "warn", "error", "debug", "trace", "log" }) do
        if type(logger[m]) == "function" then
            local orig = logger[m]
            logger[m] = function(...)
                local n = select("#", ...)
                local args = { ... }
                for i = 1, n do
                    if type(args[i]) == "string" then args[i] = native_string(args[i], 4000) end
                end
                return orig(gts_unpack(args, 1, n))
            end
        end
    end
end

if utils and type(utils.url_encode) == "function" then
    local _u = utils.url_encode
    utils.url_encode = function(t) return _u(native_string(t)) end
end

local function read_file(path)
    local f = io.open(path, "rb")
    if not f then return nil end
    local data = f:read("*a")
    f:close()
    return data
end

local function write_file(path, data)
    local f = io.open(path, "wb")
    if not f then return false end
    f:write(data)
    f:close()
    return true
end

local function write_file_atomic(path, data)
    local tmp = path .. ".tmp"
    if not write_file(tmp, data) then return false end
    pcall(os.remove, path)
    if not os.rename(tmp, path) then
        pcall(os.remove, tmp)
        return write_file(path, data)
    end
    return true
end

local function merge_defaults(target, defaults)
    for k, v in pairs(defaults) do
        if target[k] == nil then target[k] = v end
    end
    return target
end

local function scrub_state(tbl)
    if type(tbl) ~= "table" then return {} end
    return deep_safe(tbl, 0) or {}
end

local function load_state()
    local ok_c = pcall(function()
        cache = scrub_state(safe_decode(read_file(CACHE_FILE)) or {})
    end)
    if not ok_c or type(cache) ~= "table" then cache = {}; pcall(os.remove, CACHE_FILE) end

    local ok_u = pcall(function()
        custom = scrub_state(safe_decode(read_file(CUSTOM_FILE)) or {})
    end)
    if not ok_u or type(custom) ~= "table" then custom = {}; pcall(os.remove, CUSTOM_FILE) end
    local ok_i = pcall(function()
    ignored = scrub_state(safe_decode(read_file(IGNORE_FILE)) or {})
end)
if not ok_i or type(ignored) ~= "table" then ignored = {}; pcall(os.remove, IGNORE_FILE) end

    local ok_s = pcall(function()
        local loaded = safe_decode(read_file(CONFIG_FILE)) or {}
        if type(loaded) ~= "table" then loaded = {} end
        if (loaded.config_version or 0) < 14 then
    loaded.confirm_before_download = true
end
if (loaded.config_version or 0) < CONFIG_VERSION then loaded.config_version = CONFIG_VERSION end
        settings = merge_defaults(loaded, DEFAULT_SETTINGS)
        -- v21: retire legacy modes unconditionally, including old user settings.
        settings.manual_search = false
        settings.confirm_before_download = false
    end)
    if not ok_s or type(settings) ~= "table" then
        settings = merge_defaults({}, DEFAULT_SETTINGS)
        pcall(os.remove, CONFIG_FILE)
    end
end

local function save_cache()
    local s = safe_encode(cache)
    if not s then return false end
    pcall(fs.create_directories, AUTO_BACKUP_DIR)
    -- Preserve the preceding valid index before replacing either copy.
    local old = read_file(CACHE_FILE)
    if old and type(safe_decode(old)) == 'table' and old ~= s then
        write_file_atomic(AUTO_PREVIOUS_INDEX_FILE, old)
    end
    -- Save the durable copy FIRST. If that fails, leave the old live index
    -- untouched instead of accepting a new entry without any backup.
    if not write_file_atomic(AUTO_INDEX_FILE, s) then
        logger:warn('Could not back up downloaded theme index; keeping old live index')
        return false
    end
    if not write_file_atomic(CACHE_FILE, s) then
        logger:warn('Could not update live downloaded theme index; recovery copy retained')
        return false
    end
    return true
end

local function save_settings()
    local s = safe_encode(settings); if s then write_file_atomic(CONFIG_FILE, s) end
end

local function save_custom()
    local s = safe_encode(custom); if s then write_file_atomic(CUSTOM_FILE, s) end
end
local function save_ignored()
    local s = safe_encode(ignored); if s then write_file_atomic(IGNORE_FILE, s) end
end

local function cleanup_legacy_worker()
    for _, path in ipairs({
        join(PLUGIN_DIR, "yt-dlp.exe"),
        join(PLUGIN_DIR, "yt-dlp.exe.part"),
        join(PLUGIN_DIR, "queue", "worker.alive"),
        join(PLUGIN_DIR, "queue", "ytdlp-download.done"),
        join(PLUGIN_DIR, "queue", "ytdlp-install.ps1"),
        join(PLUGIN_DIR, "queue", "worker.expected_version"),
    }) do
        pcall(os.remove, path)
    end
end

local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

local function base64_encode(input)
    input = tostring(input or "")
    local out = {}
    local out_i = 1
    for i = 1, #input, 3 do
        local b1 = input:byte(i) or 0
        local b2 = input:byte(i + 1)
        local b3 = input:byte(i + 2)
        local n = b1 * 65536 + (b2 or 0) * 256 + (b3 or 0)
        out[out_i] = b64chars:sub(math.floor(n / 262144) % 64 + 1, math.floor(n / 262144) % 64 + 1)
        out_i = out_i + 1
        out[out_i] = b64chars:sub(math.floor(n / 4096) % 64 + 1, math.floor(n / 4096) % 64 + 1)
        out_i = out_i + 1
        if b2 then
            out[out_i] = b64chars:sub(math.floor(n / 64) % 64 + 1, math.floor(n / 64) % 64 + 1)
        else
            out[out_i] = "="
        end
        out_i = out_i + 1
        if b3 then
            out[out_i] = b64chars:sub(n % 64 + 1, n % 64 + 1)
        else
            out[out_i] = "="
        end
        out_i = out_i + 1
    end
    return table.concat(out)
end

local b64lookup = {}
for i = 1, #b64chars do b64lookup[b64chars:sub(i, i)] = i - 1 end

local function base64_decode(data)
    data = tostring(data or "")
    local prefix = data:match("^data:[^,]*,")
    if prefix then data = data:sub(#prefix + 1) end
    local parts, out, n = {}, {}, 0
    local acc, accbits = 0, 0
    for i = 1, #data do
        local v = b64lookup[data:sub(i, i)]
        if v then
            acc = acc * 64 + v
            accbits = accbits + 6
            if accbits >= 8 then
                accbits = accbits - 8
                n = n + 1
                out[n] = string.char(math.floor(acc / (2 ^ accbits)) % 256)
                acc = acc % (2 ^ accbits)
                if n >= 8192 then
                    parts[#parts + 1] = table.concat(out, "", 1, n)
                    out, n = {}, 0
                end
            end
        end
    end
    if n > 0 then parts[#parts + 1] = table.concat(out, "", 1, n) end
    return table.concat(parts)
end

local function url_encode(text)
    if utils and utils.url_encode then return utils.url_encode(text) end
    return tostring(text):gsub("[^%w%-_%.~]", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
end

local function http_available()
    return http ~= nil and http.request ~= nil
end

local function norm_words(text)
    local t = tostring(text):lower():gsub("[^%w]+", " "):gsub("^%s+", ""):gsub("%s+$", "")
    return " " .. t .. " "
end

local EDITION_PHRASES = {
    "game of the year edition", "game of the year", "goty edition", "goty",
    "digital deluxe edition", "deluxe edition", "premium edition", "definitive edition",
    "complete edition", "enhanced edition", "special edition", "ultimate edition",
    "anniversary edition", "legendary edition", "collector's edition", "collectors edition",
    "gold edition", "standard edition", "vr edition", "director's cut", "directors cut",
    "hd remaster", "remastered", "remaster", "redux",
}

local function clean_game_name(name)
    local s = tostring(name):gsub("\226\132\162", ""):gsub("\194\174", ""):gsub("\194\169", ""):gsub("\226\128\153", "'"):lower()
    for _, p in ipairs(EDITION_PHRASES) do
        s = s:gsub("%f[%w]" .. p .. "%f[%W]", " ")
    end
    s = s:gsub("[%s:%-]+$", "")
    s = s:gsub("%s+", " "):gsub("^%s+", "")
    return s
end

local function name_variants(game_name)
    local variants, seen = {}, {}
    local function add(v)
        if v and #v > 2 and not seen[v] then seen[v] = true; variants[#variants + 1] = v end
    end
    local cleaned = clean_game_name(game_name)
    add(cleaned)
    add(cleaned:match("^(.-)%s*:") or cleaned:match("^(.-)%s+%-%s"))
    add((tostring(game_name):gsub("\226\132\162", ""):gsub("\194\174", ""):gsub("\194\169", "")))
    return variants
end

local GOOD_WORDS = {
    { "main theme", 45 },
    { "main menu", 40 },
    { "menu theme", 40 },
    { "title screen", 30 },
    { "theme", 30 },
    { "soundtrack", 25 },
    { "ost", 25 },
    { "menu", 15 },
    { "music", 10 },
}

local BAD_WORDS = {
    "remix", "cover", "slowed", "reverb", "nightcore", "8d", "bass boosted",
    "1 hour", "10 hours", "live", "reaction", "piano", "guitar", "violin",
    "metal version", "lofi", "lo fi", "shorts", "tutorial", "how to", "ranking",
}

local function score_candidate(c, game_name)
    local title = norm_words(c.title or "")
    local score = 0
    local words, hits = 0, 0
    for w in norm_words(game_name):gmatch("%S+") do
        words = words + 1
        if title:find(" " .. w .. " ", 1, true) then hits = hits + 1 end
    end
    c.words = words
    c.hits = hits
    if words > 0 then
        score = score + math.floor(60 * hits / words)
        if hits == words then score = score + 40 end
    end
    local needle = norm_words(game_name):match("^%s*(.-)%s*$")
    if needle ~= "" and title:find(needle, 1, true) then
        score = score + 45
        c.exact = true
        if title:sub(2, #needle + 1) == needle then
            score = score + 25
            c.start = true
        end
    elseif words >= 2 and hits < words then
        score = score - math.floor(150 * (words - hits) / words)
    end
    if c.genre and tostring(c.genre):lower():find("soundtrack", 1, true) then
        score = score + 10
    end
    if (tonumber(c.plays) or 0) >= 50000 then
        score = score + 10
    elseif (tonumber(c.plays) or 0) >= 5000 then
        score = score + 5
    end
    local game_nums = {}
    for w in norm_words(game_name):gmatch("%S+") do
        if w:match("^%d+$") then game_nums[w] = true end
    end
    for num in title:gmatch("%s(%d+)%f[%s]") do
        local n = tonumber(num)
        if n and n <= 50 and not game_nums[num] then score = score - 25 end
    end
    for _, g in ipairs(GOOD_WORDS) do
        if title:find(" " .. g[1] .. " ", 1, true) then
            score = score + g[2]
            c.theme = true
            break
        end
    end
    for _, b in ipairs(BAD_WORDS) do
        if title:find(" " .. b .. " ", 1, true) then score = score - 100 end
    end
    local sec = c.seconds
    if not sec then score = score - 10
    elseif sec < 60 then score = score - 80
    elseif sec <= 600 then score = score + 25
    elseif sec <= 1200 then score = score + 5
    else score = score - 40 end
    return score
end

local function order_candidates(candidates, game_name)
    for _, c in ipairs(candidates) do c.score = score_candidate(c, game_name) end
    table.sort(candidates, function(a, b)
        if (a.score or 0) ~= (b.score or 0) then return (a.score or 0) > (b.score or 0) end
        if (a.exact or false) ~= (b.exact or false) then return (a.exact or false) end
        if (a.plays or 0) ~= (b.plays or 0) then return (a.plays or 0) > (b.plays or 0) end
        return (a.title or "") < (b.title or "")
    end)
    return candidates
end

local function build_exclude(exclude)
    local set = {}
    if type(exclude) == "string" and exclude ~= "" then exclude = safe_decode(exclude) end
    if type(exclude) == "table" then
        for _, title in ipairs(exclude) do
            if type(title) == "string" and title ~= "" then
                set[norm_words(title)] = true
            end
        end
    end
    return set
end

local function is_excluded(exclude_set, title)
    if not exclude_set then return false end
    return exclude_set[norm_words(title or "")] == true
end

local AUDIO_EXTS = { "webm", "m4a", "mp3", "ogg", "wav", "flac" }

local function looks_like_audio(path)
    local f = io.open(path, "rb")
    if not f then return false, "unreadable" end
    local head = f:read(16) or ""
    f:close()
    if #head < 4 then return false, "too_short" end
    local sig3, sig4 = head:sub(1, 3), head:sub(1, 4)
if sig3 == "ID3" or sig4 == "OggS" or sig4 == "fLaC" or sig4 == "RIFF" then return true end
if #head >= 8 and head:sub(5, 8) == "ftyp" then return true end
if sig4 == "\26\69\223\163" then return true end
    local b1, b2 = head:byte(1, 2)
    if b1 == 255 and b2 and b2 >= 224 then return true end
    return false, head:gsub("%c", "."):sub(1, 16)
end

-- v21.4.2: only cache tracks, never custom/default songs, are mirrored.
-- Steam loopback URLs still point to AUDIO_DIR, so restore files there when
-- Steam recreates its steamui directory. The backup is never served directly.
local function gts_auto_cache_name(key, name)
    if type(key) ~= 'string' or not key:match('^%d+$') or #key > 12 then return false end
    if type(name) ~= 'string' or name:find('/', 1, true) or name:find(string.char(92), 1, true) or name:find('..', 1, true) then return false end
    for _, ext in ipairs(AUDIO_EXTS) do
        if name == key .. '.' .. ext or name == key .. '_b.' .. ext then return true end
    end
    return false
end
local function gts_auto_file_length(path)
    local f = io.open(path, 'rb')
    if not f then return 0 end
    local len = f:seek('end') or 0
    f:close()
    return len
end
-- Avoid creating unnecessary .previous copies for an unchanged track.
-- Compare in bounded chunks, not full-song Lua strings. A read failure is
-- treated as NOT equal; never prune based on a failed comparison.
local function gts_auto_same_audio(left, right)
    local a, b = io.open(left, 'rb'), io.open(right, 'rb')
    if not a or not b then
        if a then a:close() end
        if b then b:close() end
        return false
    end
    local ok, equal = pcall(function()
        local al, bl = a:seek('end'), b:seek('end')
        if not al or al < 1024 or al ~= bl then return false end
        a:seek('set', 0); b:seek('set', 0)
        while true do
            local ac, bc = a:read(262144), b:read(262144)
            if ac ~= bc then return false end
            if not ac then return true end
        end
    end)
    pcall(function() a:close() end)
    pcall(function() b:close() end)
    return ok and equal == true
end
local function gts_auto_copy_audio(src, dst)
    if not looks_like_audio(src) then return false end
    if looks_like_audio(dst) and gts_auto_same_audio(src, dst) then return true end
    local fin = io.open(src, 'rb')
    if not fin then return false end
    local tmp = dst .. '.incoming'
    local fout = io.open(tmp, 'wb')
    if not fout then fin:close(); return false end
    local success, copied = true, 0
    while true do
        local bytes = fin:read(262144)
        if not bytes then break end
        copied = copied + #bytes
        if not fout:write(bytes) then success = false; break end
    end
    fin:close(); fout:close()
    if not success or copied < 1024 or not looks_like_audio(tmp) then
        pcall(os.remove, tmp)
        return false
    end
    -- Never leave the only good backup vulnerable to a truncated write.
    local previous = dst .. '.previous'
    if fs.exists(dst) then
        if looks_like_audio(dst) and src ~= previous then
            -- A valid current mirror may safely become the recovery generation.
            pcall(os.remove, previous)
            if not os.rename(dst, previous) then
                pcall(os.remove, tmp)
                return false
            end
        else
            -- A damaged mirror must NEVER replace a known-good .previous.
            -- Also preserve .previous when it is itself the recovery source.
            if not os.remove(dst) and fs.exists(dst) then
                pcall(os.remove, tmp)
                return false
            end
        end
    end
    if not os.rename(tmp, dst) then
        if src ~= previous and not fs.exists(dst) and fs.exists(previous) then pcall(os.rename, previous, dst) end
        pcall(os.remove, tmp)
        return false
    end
    return true
end
local function gts_auto_forget_audio(key, name)
    if not gts_auto_cache_name(key, name) then return end
    local target = join(AUTO_TRACK_DIR, name)
    for _, suffix in ipairs({'', '.previous', '.incoming'}) do
        pcall(fs.remove, target .. suffix)
    end
end
local function gts_auto_backup_audio(key, name)
    if not gts_auto_cache_name(key, name) then return false end
    pcall(fs.create_directories, AUTO_BACKUP_DIR)
    pcall(fs.create_directories, AUTO_TRACK_DIR)
    local src = join(AUDIO_DIR, name)
    local dst = join(AUTO_TRACK_DIR, name)
    return gts_auto_copy_audio(src, dst)
end
local function gts_auto_restore_index()
    if type(safe_decode(read_file(CACHE_FILE))) == 'table' then return end
    for _, backup in ipairs({AUTO_INDEX_FILE, AUTO_PREVIOUS_INDEX_FILE}) do
        local bytes = read_file(backup)
        if bytes and type(safe_decode(bytes)) == 'table' then
            if write_file_atomic(CACHE_FILE, bytes) then
                logger:warn('Restored downloaded-theme cache index from persistent backup')
                return
            end
        end
    end
end
local function gts_auto_reconcile_tracks()
    pcall(fs.create_directories, AUTO_BACKUP_DIR)
    pcall(fs.create_directories, AUTO_TRACK_DIR)
    pcall(fs.create_directories, AUDIO_DIR)
    for key, entry in pairs(cache) do
        local name = type(entry) == 'table' and entry.file or nil
        if gts_auto_cache_name(key, name) then
            local live = join(AUDIO_DIR, name)
            local mirror = join(AUTO_TRACK_DIR, name)
            -- Remove an old recovery generation only if it is byte-for-byte
            -- identical to a verified current mirror. Different songs and all
            -- unindexed historical files are intentionally retained.
            if looks_like_audio(mirror) and looks_like_audio(mirror .. '.previous')
                and gts_auto_same_audio(mirror, mirror .. '.previous') then
                pcall(fs.remove, mirror .. '.previous')
            end
            if not looks_like_audio(mirror) and looks_like_audio(mirror .. '.previous') then
                gts_auto_copy_audio(mirror .. '.previous', mirror)
            end
            if not looks_like_audio(live) and looks_like_audio(mirror) then
                if gts_auto_copy_audio(mirror, live) then
                    logger:warn('Restored downloaded theme audio for app ' .. key)
                end
            elseif looks_like_audio(live) and not looks_like_audio(mirror) then
                gts_auto_backup_audio(key, name)
            end
        end
    end
    local bytes = read_file(CACHE_FILE)
    if bytes and type(safe_decode(bytes)) == 'table' then
        write_file_atomic(AUTO_INDEX_FILE, bytes)
    end
end
local function download_file(key, ext, url, ua, headers)
    if not fs or not http or not http.download then return nil, "download_unsupported" end
    pcall(fs.create_directories, AUDIO_DIR)
    local filename = key .. "." .. ext
    local path = join(AUDIO_DIR, filename)
    for _, e in ipairs(AUDIO_EXTS) do
        if e ~= ext then pcall(fs.remove, join(AUDIO_DIR, key .. "." .. e)) end
    end
    local result, err = http.download(url, path, { timeout = 180, user_agent = ua, headers = headers })
    if not result or not result.success or result.status ~= 200 or (result.bytes_written or 0) <= 0 then
        pcall(fs.remove, path)
        local detail = err or (result and ("status_" .. tostring(result.status))) or "unknown"
        return nil, "download_failed: " .. tostring(detail)
    end
    if (result.bytes_written or 0) < 16384 then
        pcall(fs.remove, path)
        return nil, "download_too_small"
    end
    local valid, head = looks_like_audio(path)
    if not valid then
        pcall(fs.remove, path)
        logger:warn("downloaded file is not audio (head=" .. tostring(head) .. ", bytes=" .. tostring(result.bytes_written) .. ") url=" .. tostring(url))
        return nil, "not_audio"
    end
    return filename, nil
end

local LOCAL_EXTS = { mp3 = true, ogg = true, m4a = true, flac = true, wav = true }
local LOCAL_DIR_HINTS = { "music", "bgm", "soundtrack", "ost", "audio" }
local LOCAL_NAME_SCORES = {
    { "main theme", 60 }, { "maintheme", 60 }, { "main menu", 50 }, { "mainmenu", 50 },
    { "title screen", 48 }, { "titlescreen", 48 }, { "theme", 45 }, { "title", 40 },
    { "menu", 32 }, { "opening", 20 }, { "intro", 18 }, { "main", 16 },
}
local LOCAL_BAD_WORDS = { "sfx", "effect", "voice", "ambient", "ambience", "footstep", "trailer", "credits", "jingle", "stinger" }

local function vdf_unescape(v)
    return (tostring(v):gsub("\\\\", "\\"))
end

local _libs_cache, _libs_cache_ts = nil, 0
local function steam_libraries()
    local now = os.time()
    if _libs_cache and (now - _libs_cache_ts) < 60 then return _libs_cache end
    local libs, seen = {}, {}
    local function add(p)
        p = norm_path(p)
        local lower = p:lower()
        if #p > 2 and not seen[lower] and fs.exists(join(p, "steamapps")) then
            seen[lower] = true
            libs[#libs + 1] = p
        end
    end
    local root = norm_path(millennium.steam_path())
    add(root)
    local body = read_file(join(root, "steamapps", "libraryfolders.vdf"))
    if body then
        for p in body:gmatch('"path"%s*"([^"]*)"') do add(vdf_unescape(p)) end
    end
    _libs_cache, _libs_cache_ts = libs, now
    return libs
end

local function find_install_dir(key)
    for _, lib in ipairs(steam_libraries()) do
        local manifest = read_file(join(lib, "steamapps", "appmanifest_" .. key .. ".acf"))
        if manifest then
            local dir = manifest:match('"installdir"%s*"([^"]*)"')
            if dir and dir ~= "" then
                local full = join(lib, "steamapps", "common", vdf_unescape(dir))
                if fs.exists(full) then return full end
            end
        end
    end
    return nil
end

local function collect_audio_files(root, max_depth, max_entries)
    local results = {}
    local queue = { { path = root, depth = 0 } }
    local qi, scanned = 1, 0
    while qi <= #queue do
        local item = queue[qi]
        qi = qi + 1
        local entries = fs.list(item.path)
        if type(entries) == "table" then
            for _, e in ipairs(entries) do
                scanned = scanned + 1
                if scanned > max_entries then return results end
                if e.is_directory then
                    if item.depth < max_depth then queue[#queue + 1] = { path = e.path, depth = item.depth + 1 } end
                elseif e.is_file then
                    local ext = tostring(e.name):match("%.(%w+)$")
                    ext = ext and ext:lower()
                    if ext and LOCAL_EXTS[ext] then
                        local size = tonumber(e.size) or 0
                        if size >= 300 * 1024 and size <= 60 * 1024 * 1024 then
                            results[#results + 1] = { path = tostring(e.path), name = tostring(e.name), rel = tostring(e.path):sub(#root + 2) }
                        end
                    end
                end
            end
        end
    end
    return results
end

local function score_local_file(rel)
    local words = " " .. rel:lower():gsub("[^%w]+", " ") .. " "
    local score = 0
    for _, entry in ipairs(LOCAL_NAME_SCORES) do
        if words:find(" " .. entry[1] .. " ", 1, true) then score = score + entry[2]; break end
    end
    for _, b in ipairs(LOCAL_BAD_WORDS) do
        if words:find(" " .. b .. " ", 1, true) then score = score - 60 end
    end
    for _, h in ipairs(LOCAL_DIR_HINTS) do
        if words:find(" " .. h .. " ", 1, true) then score = score + 8; break end
    end
    return score
end

local mem_cache = { soundtrack = {}, khinsider = {}, track_mp3 = {}, ia = {} }

local function pick_soundtrack_track(game_name)
    local target = norm_words(clean_game_name(game_name)):gsub("^%s+", ""):gsub("%s+$", "")
    if #target < 3 then return nil end
    local now = os.time()
    local cached = mem_cache.soundtrack[target]
    if cached and (now - cached.ts) < 90 then
        if cached.value == false then return nil end
        return cached.value
    end
    local found = nil
    for _, lib in ipairs(steam_libraries()) do
        local entries = fs.list(join(lib, "steamapps", "music"))
        if type(entries) == "table" then
            for _, e in ipairs(entries) do
                if e.is_directory and norm_words(tostring(e.name)):find(target, 1, true) then
                    local files = collect_audio_files(tostring(e.path), 3, 2000)
                    local best, best_score
                    for _, f in ipairs(files) do
                        local sc = score_local_file(f.rel)
                        if f.name:match("^%D*0?1[%.%s%-_]") then sc = sc + 12 end
                        if not best or sc > best_score or (sc == best_score and f.name < best.name) then best, best_score = f, sc end
                    end
                    if best then found = best; break end
                end
            end
        end
        if found then break end
    end
    mem_cache.soundtrack[target] = { value = found or false, ts = now }
    return found
end

local function pick_install_track(dir)
    local files = collect_audio_files(dir, 4, 6000)
    local best, best_score
    for _, f in ipairs(files) do
        local sc = score_local_file(f.rel)
        if sc >= 16 and (not best or sc > best_score or (sc == best_score and f.path < best.path)) then
            best, best_score = f, sc
        end
    end
    return best
end

local function local_resolve(game_name, key, exclude_set, dl_base)
    if not (fs and fs.list and fs.copy and fs.exists) then return nil, "local_unsupported" end
    dl_base = dl_base or key
    local picked = pick_soundtrack_track(game_name)
    if not picked then
        local dir = find_install_dir(key)
        if dir then picked = pick_install_track(dir) end
    end
    if not picked then return nil, "no_local_audio" end
    local picked_title = (tostring(picked.name):gsub("%.%w+$", ""))
    if is_excluded(exclude_set, picked_title) then return nil, "local_excluded" end
    local ext = tostring(picked.name):match("%.(%w+)$")
    if not ext then return nil, "no_local_audio" end
    ext = ext:lower()
    pcall(fs.create_directories, AUDIO_DIR)
    for _, e in ipairs(AUDIO_EXTS) do
        if e ~= ext then pcall(fs.remove, join(AUDIO_DIR, dl_base .. "." .. e)) end
    end
    local copied = fs.copy(picked.path, join(AUDIO_DIR, dl_base .. "." .. ext))
    if not copied then return nil, "local_copy_failed" end
    return { file = dl_base .. "." .. ext, title = (tostring(picked.name):gsub("%.%w+$", "")) }
end

local KHINSIDER_BASE = "https://downloads.khinsider.com"
local BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
local KH_HEADERS = {
    ["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ["accept-language"] = "en-US,en;q=0.9",
    ["sec-fetch-mode"] = "navigate",
    ["sec-fetch-site"] = "same-origin",
    ["upgrade-insecure-requests"] = "1",
}

local function khinsider_get(url, referer)
    local headers = {}
    for k, v in pairs(KH_HEADERS) do headers[k] = v end
    if referer then headers["referer"] = referer end
    local resp, err = http.request(url, { method = "GET", timeout = 20, user_agent = BROWSER_UA, headers = headers })
    if resp and resp.status == 200 and resp.body then return cap_body(resp.body), nil end
    return nil, tostring(err or (resp and resp.status) or "no_response")
end

local function khinsider_pick_album(body, game_name)
    local albums, seen = {}, {}
    for href, title in body:gmatch('<a href="(/game%-soundtracks/album/[^"]+)">([^<]+)</a>') do
        if not seen[href] then
            seen[href] = true
            albums[#albums + 1] = { href = href, title = title }
        end
    end
    if #albums == 0 then return nil end
    local target = norm_words(game_name)
    local best, best_score = nil, 0
    for i, a in ipairs(albums) do
        local t = norm_words(a.title)
        local score = 0
        if t == target then score = 1000
        elseif t:find(target, 1, true) then score = 500 end
        if score > 0 then
            local lt = a.title:lower()
            if lt:find("sound effects", 1, true) or lt:find("concert", 1, true) or lt:find("remix", 1, true) then
                score = score - 400
            end
            score = score - i
        end
        if score > best_score then best, best_score = a, score end
    end
    return best
end

local function khinsider_pick_tracks(body)
    local tracks, seen = {}, {}
    for href, name in body:gmatch('<td class="clickable%-row"><a href="(/game%-soundtracks/album/[^"]+%.mp3)">([^<]+)</a>') do
        if not seen[href] then
            seen[href] = true
            local n = " " .. tostring(name):lower() .. " "
            local score = 0
            if n:find("main theme", 1, true) then score = 50
            elseif n:find("theme", 1, true) then score = 40
            elseif n:find("main menu", 1, true) then score = 35
            elseif n:find("title", 1, true) then score = 25
            elseif n:find("menu", 1, true) then score = 20 end
            score = score - #tracks
            tracks[#tracks + 1] = { href = href, name = name, score = score }
        end
    end
    if #tracks == 0 then return nil end
    table.sort(tracks, function(a, b)
        if (a.score or 0) ~= (b.score or 0) then return (a.score or 0) > (b.score or 0) end
        return a.name < b.name
    end)
    return tracks
end

local function khinsider_resolve(game_name, key, exclude_set, dl_base)
    dl_base = dl_base or key
    if not http_available() then return nil, "http_module_missing" end
    local query = tostring(game_name):gsub("\226\132\162", ""):gsub("\194\174", ""):gsub("\194\169", "")
    local now = os.time()
    local search_url = KHINSIDER_BASE .. "/search?search=" .. url_encode(query)
    local album, tracks
    local cached = mem_cache.khinsider[query]
    if cached and (now - cached.ts) < 180 then
        album, tracks = cached.album, cached.tracks
    else
        local body, err = khinsider_get(search_url, KHINSIDER_BASE)
        if not body then return nil, "khinsider_search_failed: " .. tostring(err) end
        album = khinsider_pick_album(body, query)
        if not album then return nil, "khinsider_no_album" end
        local album_url = KHINSIDER_BASE .. album.href
        local album_body, aerr = khinsider_get(album_url, search_url)
        if not album_body then return nil, "khinsider_album_failed: " .. tostring(aerr) end
        tracks = khinsider_pick_tracks(album_body)
        if not tracks then return nil, "khinsider_no_tracks" end
        mem_cache.khinsider[query] = { album = album, tracks = tracks, ts = now }
    end
    local last_err = "khinsider_no_tracks"
    for _, track in ipairs(tracks) do
        local title = track.name .. " (" .. album.title .. ")"
        if not is_excluded(exclude_set, title) then
            local mp3 = mem_cache.track_mp3[track.href]
            if not mp3 then
                local track_url = KHINSIDER_BASE .. track.href
                local track_body, terr = khinsider_get(track_url, KHINSIDER_BASE .. album.href)
                if track_body then
                    mp3 = track_body:match('href="(https://[^"]+%.mp3)"')
                    if mp3 then mem_cache.track_mp3[track.href] = mp3 end
                else
                    last_err = "khinsider_track_failed: " .. tostring(terr)
                end
            end
            if mp3 then
                local filename, dl_err = download_file(dl_base, "mp3", mp3, BROWSER_UA, { ["referer"] = KHINSIDER_BASE .. track.href })
                if filename then return { file = filename, title = title }, nil end
                last_err = dl_err
            elseif last_err == "khinsider_no_tracks" then
                last_err = "khinsider_no_mp3_link"
            end
        end
    end
    return nil, last_err
end

local SC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
local sc_client_id = nil

local IA_SEARCH = "https://archive.org/advancedsearch.php"
local IA_DL = "https://archive.org/download/"

local function ia_pick_item(docs, game_name)
    local target = norm_words(game_name)
    local best, best_score = nil, 0
    for _, d in ipairs(docs) do
        local t = norm_words(tostring(d.title or ""))
        local score = 0
        if t == target then
            score = 1000
        elseif t:find(target, 1, true) then
            score = 600
        else
            local words, hits = 0, 0
            for w in target:gmatch("%S+") do
                words = words + 1
                if t:find(" " .. w .. " ", 1, true) then hits = hits + 1 end
            end
            if words > 0 and hits == words then score = 300 end
        end
        if score > best_score then
            best, best_score = d, score
        end
    end
    return best
end

local function ia_pick_track(files, album_title)
    local tracks = {}
    for _, f in ipairs(files) do
        local n = tostring(f.name or "")
        if n:lower():match("%.mp3$") then
            local title = tostring(f.title or n:match("([^/]+)%.mp3$") or n)
            local lower = " " .. title:lower() .. " "
            local score = 0
            if lower:find("main theme", 1, true) then score = 50
            elseif lower:find("theme", 1, true) then score = 40
            elseif lower:find("main menu", 1, true) then score = 35
            elseif lower:find("title", 1, true) then score = 25
            elseif lower:find("menu", 1, true) then score = 20 end
            local len = tonumber(tostring(f.length or ""):match("^%d+")) or 0
            if len >= 60 and len <= 600 then score = score + 15 end
            local track_no = tonumber(tostring(f.track or "")) or 999
            score = score - math.min(track_no, 20)
            tracks[#tracks + 1] = { f = f, title = title, score = score }
        end
    end
    if #tracks == 0 then return nil end
    table.sort(tracks, function(a, b)
        if (a.score or 0) ~= (b.score or 0) then return (a.score or 0) > (b.score or 0) end
        return (a.f.name or "") < (b.f.name or "")
    end)
    local picked = tracks[1]
    return { file = picked.f, title = picked.title .. " (" .. tostring(album_title or "Internet Archive") .. ")" }
end

local function ia_resolve(game_name, key, exclude_set, dl_base)
    dl_base = dl_base or key
    if not http_available() then return nil, "http_module_missing" end
    local now = os.time()
    local cached = mem_cache.ia[game_name]
    if cached and (now - cached.ts) < 180 then
        if not cached.picked then return nil, cached.err end
        if is_excluded(exclude_set, cached.picked.title) then return nil, "ia_excluded" end
        local escaped = url_encode(cached.picked.file.name):gsub("%%2F", "/")
        local dl_url = IA_DL .. cached.identifier .. "/" .. escaped
        local filename, dl_err = download_file(dl_base, "mp3", dl_url, BROWSER_UA)
        if filename then return { file = filename, title = cached.picked.title }, nil end
        return nil, "ia_download_failed: " .. tostring(dl_err)
    end
    local clean = tostring(game_name):gsub("\226\132\162", ""):gsub("\194\174", ""):gsub("\194\169", "")
    local query = url_encode('title:("' .. clean .. '") AND mediatype:audio')
    local url = IA_SEARCH .. "?q=" .. query .. "&fl%5B%5D=identifier&fl%5B%5D=title&rows=10&page=1&output=json"
    local resp = http.request(url, { timeout = 20, user_agent = BROWSER_UA })
    if not resp or resp.status ~= 200 or not resp.body then return nil, "ia_search_failed_" .. tostring(resp and resp.status) end
    local data = safe_decode(cap_body(resp.body))
    if type(data) ~= "table" or type(data.response) ~= "table" or type(data.response.docs) ~= "table" or #data.response.docs == 0 then
        return nil, "ia_no_items"
    end
    local item = ia_pick_item(data.response.docs, clean)
    if not item then return nil, "ia_no_match" end
    local meta_resp = http.request(IA_DL .. item.identifier .. "/metadata.json", { timeout = 20, user_agent = BROWSER_UA })
    if not meta_resp or meta_resp.status ~= 200 or not meta_resp.body then
        mem_cache.ia[game_name] = { ts = now, err = "ia_meta_failed" }
        return nil, "ia_meta_failed"
    end
    local meta = safe_decode(cap_body(meta_resp.body))
    if type(meta) ~= "table" or type(meta.files) ~= "table" then
        mem_cache.ia[game_name] = { ts = now, err = "ia_no_files" }
        return nil, "ia_no_files"
    end
    local picked = ia_pick_track(meta.files, meta.title or item.title)
    if not picked then
        mem_cache.ia[game_name] = { ts = now, err = "ia_no_tracks" }
        return nil, "ia_no_tracks"
    end
    mem_cache.ia[game_name] = { ts = now, picked = picked, identifier = item.identifier }
    if is_excluded(exclude_set, picked.title) then return nil, "ia_excluded" end
    local escaped = url_encode(picked.file.name):gsub("%%2F", "/")
    local dl_url = IA_DL .. item.identifier .. "/" .. escaped
    local filename, dl_err = download_file(dl_base, "mp3", dl_url, BROWSER_UA)
    if filename then return { file = filename, title = picked.title }, nil end
    return nil, "ia_download_failed: " .. tostring(dl_err)
end

local function sc_fetch_client_id()
    local resp = http.request("https://soundcloud.com/", { user_agent = SC_UA })
    if not resp or resp.status ~= 200 or not resp.body then return nil, "sc_home_failed" end
    local home_body = cap_body(resp.body)
    local assets = {}
    for u in home_body:gmatch('src="(https://a%-v2%.sndcdn%.com/assets/[^"]+%.js)"') do
        assets[#assets + 1] = u
    end
    for i = #assets, 1, -1 do
        local js = http.request(assets[i], { user_agent = SC_UA })
        if js and js.status == 200 and js.body then
            local cid = cap_body(js.body):match('client_id%s*[:=]%s*"(%w+)"')
            if cid and #cid == 32 then return cid, nil end
        end
    end
    return nil, "sc_no_client_id"
end

local function sc_api(path_and_query)
    if not http_available() then return nil, "http_module_missing" end
    if not sc_client_id then
        local cid, err = sc_fetch_client_id()
        if not cid then return nil, err end
        sc_client_id = cid
    end
    local sep = path_and_query:find("?", 1, true) and "&" or "?"
    local url = "https://api-v2.soundcloud.com" .. path_and_query .. sep .. "client_id=" .. sc_client_id
    local resp = http.request(url, { user_agent = SC_UA })
    if resp and (resp.status == 401 or resp.status == 403) then
        local cid = sc_fetch_client_id()
        if cid then
            sc_client_id = cid
            url = "https://api-v2.soundcloud.com" .. path_and_query .. sep .. "client_id=" .. sc_client_id
            resp = http.request(url, { user_agent = SC_UA })
        end
    end
    if not resp or resp.status ~= 200 or not resp.body then
        return nil, "sc_api_failed_" .. tostring(resp and resp.status)
    end
    return safe_decode(cap_body(resp.body)), nil
end

local SC_MIN_SCORE = 30
local SC_MAX_TRIES = 5

local function sc_collect_candidates(query, candidates, seen)
    local data, err = sc_api("/search/tracks?q=" .. url_encode(query) .. "&limit=25")
    if not data or type(data.collection) ~= "table" then return nil, err or "sc_search_failed" end
    for _, t in ipairs(data.collection) do
        if type(t) == "table" then
            local prog = nil
            local media = t.media or {}
            for _, tr in ipairs(media.transcodings or {}) do
                local fmt = tr.format or {}
                if fmt.protocol == "progressive" and tr.url then prog = tr.url break end
            end
            if prog then
                local title = tostring(t.title or "")
                local dedup = norm_words(title)
                if not seen[dedup] then
                    seen[dedup] = true
                    candidates[#candidates + 1] = {
                        title = title,
                        seconds = math.floor((tonumber(t.duration) or 0) / 1000),
                        stream_api = prog,
                        genre = tostring(t.genre or ""),
                        plays = tonumber(t.playback_count) or 0,
                    }
                end
            end
        end
    end
    return true
end

local function sc_resolve(game_name, key, exclude_set, dl_base)
    dl_base = dl_base or key
    if not http_available() then return nil, "http_module_missing" end
    local queries = { game_name .. (settings.search_suffix or "") }
    local alt = game_name .. " soundtrack"
    if alt ~= queries[1] then queries[#queries + 1] = alt end
    local candidates, seen, last_err = {}, {}, nil
    for _, q in ipairs(queries) do
        local ok, err = sc_collect_candidates(q, candidates, seen)
        if not ok then last_err = err end
    end
    if #candidates == 0 then return nil, last_err or "sc_no_results" end
    order_candidates(candidates, game_name)
    local tried = 0
    for _, c in ipairs(candidates) do
        if tried >= SC_MAX_TRIES or (c.score or 0) < SC_MIN_SCORE then break end
        local confident = c.exact or ((c.words or 0) > 0 and (c.hits or 0) / c.words >= 0.6)
        if not (confident and c.theme) then break end
        if not is_excluded(exclude_set, c.title) then
            tried = tried + 1
            local sep = c.stream_api:find("?", 1, true) and "&" or "?"
            local resp = http.request(c.stream_api .. sep .. "client_id=" .. tostring(sc_client_id), { user_agent = SC_UA })
            local meta = (resp and resp.status == 200 and resp.body) and safe_decode(cap_body(resp.body)) or nil
            if meta and type(meta.url) == "string" then
                local file, dl_err = download_file(dl_base, "mp3", meta.url, SC_UA)
                if file then return { file = file, title = c.title }, nil end
                logger:warn("sc download failed: " .. tostring(dl_err))
            end
        end
    end
    return nil, "sc_no_good_match"
end

local resolve_busy = false
local io_busy = false
local custom_list_cache = nil

local function try_fallback()
    local f = settings.fallback_file
    if type(f) ~= "string" or f == "" then return nil end
    if not (fs and fs.exists and fs.exists(join(AUDIO_DIR, f))) then return nil end
    local ts = tonumber(settings.fallback_ts) or 0
    return json.encode({
        ok = true,
        url = LOOPBACK_BASE .. f .. "?v=" .. tostring(ts),
        title = sanitize_text(tostring(settings.fallback_title or "")),
        cached = true,
        fallback = true,
    })
end

local function run_io(name, fn)
  if io_busy or resolve_busy then return json.encode({ ok = false, error = "busy" }) end
  io_busy = true
  local ok, res = pcall(fn)
  io_busy = false
  if not ok then
    logger:warn(name .. " failed: " .. tostring(res))
    return json.encode({ ok = false, error = "internal_error" })
  end
  return res
end

-- Game Theme Song v20: YouTube-only ranked automatic soundtrack discovery.
-- Do not call any of the old Khinsider/Internet Archive/SoundCloud resolvers.
-- yt-dlp is a local dependency, and only canonical 11-character video IDs are downloaded.
local gts20_sessions = {}
local gts20_last_check = 0
local gts20_executable = nil
local GTS20_AUTO_SCORE = 98
local GTS20_GAP_SCORE = 12

local function gts20_valid_app(app_id)
    local key = tostring(app_id or '')
    if not key:match('^%d+$') or #key > 12 or tonumber(key) == 0 then return nil end
    return key
end

local function gts20_exe()
    if SEP ~= '\\' or not fs or not utils or type(utils.exec) ~= 'function' then return nil end
    if gts20_executable then return gts20_executable end
    local path = join(DATA_DIR, 'yt-dlp.exe')
    local exe = (fs.exists and fs.exists(path)) and ('"' .. path .. '"') or 'yt-dlp'
    local _, status = utils.exec(exe .. ' --version')
    if status == 0 then gts20_executable = exe; return exe end
    return nil
end

local function gts20_safe_path(stem)
    -- cmd.exe expands % and ! even in double-quoted strings.
    return not stem:find('["%%!\r\n]')
end

local function gts20_safe_name(game_name)
    local raw = sanitize_text(game_name or '', 130)
    local clean = raw:gsub('[^%w%s%-]', ' '):gsub('%s+', ' '):match('^%s*(.-)%s*$') or ''
    if #clean < 3 then return nil end
    return clean:sub(1, 90)
end

local function gts20_lower(text)
    return tostring(text or ''):lower():gsub('[^%w]+', ' '):gsub('%s+', ' '):match('^%s*(.-)%s*$') or ''
end

local function gts20_score(candidate, game_name)
    local title = gts20_lower(candidate.title)
    local game = gts20_lower(game_name)
    if game == '' or title == '' then return -1000, false end
    local game_tokens, relevant, total = {}, 0, 0
    for token in game:gmatch('%S+') do
        if #token > 2 and token ~= 'the' and token ~= 'and' and token ~= 'edition' and token ~= 'game' then
            game_tokens[#game_tokens + 1] = token
        end
    end
    for _, token in ipairs(game_tokens) do
        total = total + 1
        if title:find('%f[%w]' .. token .. '%f[%W]') then relevant = relevant + 1 end
    end
    if total == 0 then return -1000, false end
    local coverage = relevant / total
    if coverage < 0.85 then return -1000, false end
    local full_name = title:find(game, 1, true) ~= nil
    local score = (full_name and 52 or 20) + math.floor(coverage * 28)
    -- Put actual main-menu/main-theme tracks before generic OST uploads.
    -- Game-title coverage must still pass the existing relevance gate.
    local preferred = title:find('main menu', 1, true) or title:find('main theme', 1, true)
    local other_theme = title:find('title theme', 1, true) or title:find('title screen', 1, true)
       or title:find('opening theme', 1, true)
    if preferred then score = score + 84
    elseif other_theme then score = score + 32 end
    if title:find('%f[%w]ost%f[%W]') then score = score + 18 end
    if title:find('original soundtrack', 1, true) then score = score + 16 end
    if title:find('official soundtrack', 1, true) then score = score + 17 end
    if title:find('soundtrack', 1, true) then score = score + 8 end
    if title:find('theme', 1, true) then score = score + 6 end
    local uploader = gts20_lower(candidate.uploader)
    if uploader:find('official', 1, true) then score = score + 7 end
    local penalties = {
      'remix', 'cover', 'reaction', 'review', 'gameplay', 'walkthrough', 'playthrough',
      'trailer', 'tutorial', 'comparison', 'ranking', 'compilation', 'full album',
      'complete ost', 'full ost', 'full soundtrack', 'extended', 'one hour', '1 hour',
      '10 hour', 'slowed', 'nightcore', 'fanmade', 'fan made', 'ai generated'
    }
    local bad = false
    for _, term in ipairs(penalties) do
      if title:find(term, 1, true) then score = score - 75; bad = true end
    end
    local length = tonumber(candidate.duration) or 0
    if length <= 0 or length > 900 then score = score - 55 end
    if length >= 45 and length <= 480 then score = score + 9 end
    -- v20.2: user-selected confidence rule. The video title must explicitly
    -- contain the complete game's name AND either 'OST' or 'soundtrack'.
    -- Ranking still prefers main themes and penalizes non-OST material.
    local has_soundtrack_keyword = title:find('%f[%w]ost%f[%W]') ~= nil
      or title:find('%f[%w]soundtrack%f[%W]') ~= nil
    local qualified = full_name and has_soundtrack_keyword
    return score, qualified
end

-- An explicit manual search is deliberately different from automatic detection:
-- results need not contain Steam's game title, and can NEVER auto-download.
-- Restrict characters before building a Windows shell command for yt-dlp.
local function gts20_manual_query(input)
    if type(input) ~= 'string' then return nil end
    if #input > 300 then return nil end
    local clean = input:gsub('[^%w%s%-]', ' '):gsub('%s+', ' '):match('^%s*(.-)%s*$') or ''
    if #clean < 2 or #clean > 120 then return nil end
    return clean
end

local function gts20_custom_score(candidate, query)
    local title = gts20_lower(candidate.title)
    local wanted = gts20_lower(query)
    local total, matched = 0, 0
    for token in wanted:gmatch('%S+') do
        if #token >= 2 then
            total = total + 1
            if title:find('%f[%w]' .. token .. '%f[%W]') then matched = matched + 1 end
        end
    end
    local score = total > 0 and math.floor(75 * matched / total) or 0
    if title:find(wanted, 1, true) then score = score + 30 end
    if title:find('main menu', 1, true) or title:find('main theme', 1, true) then
        score = score + 50
    end
    if title:find('remix', 1, true) or title:find('reaction', 1, true)
        or title:find('review', 1, true) or title:find('gameplay', 1, true) then
        score = score - 45
    end
    local duration = tonumber(candidate.duration) or 0
    if duration > 900 then score = score - 35 end
    if duration >= 45 and duration <= 480 then score = score + 8 end
    return score
end

-- v3.0.0 audit fix 2: ONLY YouTube search/full-download scratch files.
-- Never sweep AUDIO_DIR, cache.json, custom songs or persistent auto backups.
local gts20_work_dir = join(DATA_DIR, 'gts20_work_scratch')
local gts20_work_sequence = 0

local function gts20_work_scan(dir, predicate)
    if not fs or type(fs.list) ~= 'function' then return false end
    local ok, entries = pcall(fs.list, dir)
    if not ok or type(entries) ~= 'table' then return false end
    for _, item in ipairs(entries) do
        local name = type(item) == 'table' and item.name or nil
        if item.is_file and type(name) == 'string'
           and not name:find('/', 1, true)
           and not name:find(string.char(92), 1, true)
           and predicate(name) then
            pcall(fs.remove, join(dir, name))
        end
    end
    return true
end

local function gts20_work_cleanup(stem, kind)
    local dir = gts20_work_dir
    local normalized = stem:gsub(string.char(92), '/')
    local prefix = (normalized:match('([^/]+)$') or normalized) .. '.'
    gts20_work_scan(dir, function(name)
        return name:sub(1, #prefix) == prefix
    end)
    -- If this Millennium build lacks fs.list, remove the supported yt-dlp
    -- formats and common sidecars directly. A later startup sweep covers any
    -- unknown sidecars once directory listing becomes available.
    if kind == 'audio' then
        for _, suffix in ipairs({'m4a', 'webm', 'mp3', 'ogg', 'wav', 'flac',
            'opus', 'mp4', 'mkv', 'part', 'ytdl', 'info.json',
            'm4a.part', 'webm.part', 'mp3.part', 'ogg.part', 'opus.part', 'oldcustom', 'oldbackup'}) do
            pcall(fs.remove, stem .. '.' .. suffix)
        end
    else
        pcall(fs.remove, stem .. '.json')
    end
end

-- These are artifacts of our *previous versions*, which placed transient
-- files directly in DATA_DIR. Match those exact naming schemes only.
-- The new scratch folder contains only our own recognizable job files.
do
    gts20_work_scan(gts20_work_dir, function(name)
        return name:match('^gts20_search_%d+_%d+_%d+%..+$') ~= nil
            or name:match('^gts20_audio_%d+_%d+_%d+_%d+%..+$') ~= nil
    end)
    gts20_work_scan(DATA_DIR, function(name)
        return name:match('^gts20_search_%d+_%d+%.json$') ~= nil
            or name:match('^gts20_audio_%d+_%d+%..+$') ~= nil
    end)
end

local function gts20_work_new(kind, key)
    local ok = pcall(fs.create_directories, gts20_work_dir)
    if not ok or not fs.exists(gts20_work_dir) then
        return nil, 'download_temp_dir_unavailable'
    end
    gts20_work_sequence = gts20_work_sequence + 1
    -- The counter keeps consecutive jobs unique; the clock/random suffix
    -- also distinguishes attempts across process restarts within one second.
    local suffix = tostring(os.time()) .. '_' .. tostring(gts20_work_sequence)
        .. '_' .. tostring(math.floor(os.clock() * 1000000))
        .. tostring(math.random(100000, 999999))
    local basename = (kind == 'audio' and ('gts20_audio_' .. key)
        or 'gts20_search') .. '_' .. suffix
    local stem = join(gts20_work_dir, basename)
    if not gts20_safe_path(stem) then return nil, 'unsupported_install_path' end
    return stem
end

local function gts20_collect_results(game_name, custom_query)
    local name = gts20_safe_name(game_name)
    if not name then return nil, 'search_title_unsupported' end
    local exe = gts20_exe()
    if not exe then return nil, 'yt_dlp_missing' end
    ensure_data_dir()
    local manual = custom_query ~= nil and custom_query ~= ''
    local search_queries
    if manual then
        local query = gts20_manual_query(custom_query)
        if not query then return nil, 'invalid_custom_search' end
        search_queries = {query}
    else
        search_queries = {
            name .. ' main menu ost',
            name .. ' main theme ost',
            name .. ' official soundtrack main menu',
            name .. ' title screen theme'
        }
    end
    local found, ids = {}, {}
    for index, query in ipairs(search_queries) do
        local stem, stem_err = gts20_work_new('search')
        if not stem then return nil, stem_err end
        local metadata_path = stem .. '.json'
        local limit = manual and 15 or 7
        local cmd = exe .. ' --ignore-errors --quiet --no-warnings --flat-playlist'
           .. ' --dump-single-json --socket-timeout 15 --retries 1 --playlist-end ' .. limit
           .. ' "ytsearch' .. limit .. ':' .. query .. '" > "' .. metadata_path .. '"'
        -- Even an exception in the shell or JSON parser must not strand a job.
        local ran, _, status = pcall(utils.exec, cmd)
        local decoded_ok, data = pcall(function()
            if ran and status == 0 then return safe_decode(read_file(metadata_path) or '') end
            return nil
        end)
        gts20_work_cleanup(stem, 'search')
        if not decoded_ok then data = nil end
        if type(data) == 'table' and type(data.entries) == 'table' then
            for _, item in ipairs(data.entries) do
                if type(item) == 'table' then
                    local id = tostring(item.id or '')
                    if #id == 11 and id:match('^[A-Za-z0-9_-]+$') and not ids[id] then
                        ids[id] = true
                        local cand = {
                            id = id, title = sanitize_text(item.title or '', 190),
                            uploader = sanitize_text(item.uploader or item.channel or '', 100),
                            duration = tonumber(item.duration) or 0
                        }
                        cand.score, cand.qualified = gts20_score(cand, name)
                        if manual then
                            -- Relevance to the hand-written query can outrank the
                            -- game's name, but results always require confirmation.
                            cand.score = gts20_custom_score(cand, query)
                                + (cand.score > -300 and 18 or 0)
                            cand.qualified = false
                            found[#found + 1] = cand
                        elseif cand.score > -300 then
                            found[#found + 1] = cand
                        end
                    end
                end
            end
        end
    end
    table.sort(found, function(a, b)
        if a.score ~= b.score then return a.score > b.score end
        return a.id < b.id
    end)
    while #found > 12 do table.remove(found) end
    if #found == 0 then return nil, 'youtube_no_results' end
    return found, nil
end

-- v3.0.0 audit fix 3: bounded, lazy search-session retention.
-- Keep the existing 4-minute result reuse and 15-minute preview/approval
-- authorization. No periodic timer, file I/O, or theme-cache modification.
local GTS20_SESSION_TTL = 900
local GTS20_SESSION_LIMIT = 64
local gts20_session_access = 0

local function gts20_touch_session(session)
    gts20_session_access = gts20_session_access + 1
    session.last_access = gts20_session_access
end

local function gts20_prune_sessions()
    local now = os.time()
    local retained = {}
    for key, session in pairs(gts20_sessions) do
        local stamp = type(session) == 'table' and tonumber(session.ts) or nil
        if not stamp or stamp > now or now - stamp >= GTS20_SESSION_TTL then
            gts20_sessions[key] = nil
        else
            retained[#retained + 1] = {
                key = key, stamp = stamp, access = tonumber(session.last_access) or 0
            }
        end
    end
    if #retained <= GTS20_SESSION_LIMIT then return end
    -- Evict least-recently-used sessions only when under pressure. Sorting
    -- provides predictable results without a potentially expensive O(n^2)
    -- scan when upgrading from an older unbounded session table.
    table.sort(retained, function(a, b)
        if a.access ~= b.access then return a.access < b.access end
        if a.stamp ~= b.stamp then return a.stamp < b.stamp end
        return tostring(a.key) < tostring(b.key)
    end)
    for i = 1, #retained - GTS20_SESSION_LIMIT do
        gts20_sessions[retained[i].key] = nil
    end
end

local function gts20_candidates(app_id, game_name, refresh, custom_query)
    local key = gts20_valid_app(app_id)
    if not key then return nil, 'invalid_app_id' end
    gts20_prune_sessions()
    local query = custom_query or ''
    local previous = gts20_sessions[key]
    if not refresh and previous and previous.name == game_name
        and (previous.query or '') == query and os.time() - previous.ts < 240 then
        gts20_touch_session(previous)
        return previous.items, nil
    end
    local items, err = gts20_collect_results(game_name, query)
    if items then
        local session = {name = game_name, query = query, items = items, ts = os.time()}
        gts20_touch_session(session)
        gts20_sessions[key] = session
        gts20_prune_sessions()
    end
    return items, err
end

-- v3.0.0 audit fix 9: copy audio in 256 KiB chunks. Never hold
-- the full downloaded/new/previous tracks simultaneously in Lua memory.
local function gts20_stream_copy(src, dst)
    local input = io.open(src, 'rb')
    if not input then return false end
    local output = io.open(dst, 'wb')
    if not output then input:close(); return false end
    local ok, length = pcall(function()
        local total = 0
        while true do
            local chunk = input:read(262144)
            if not chunk then break end
            if #chunk == 0 then break end
            if not output:write(chunk) then return -1 end
            total = total + #chunk
            if total > 50 * 1024 * 1024 then return -1 end
        end
        return total
    end)
    pcall(function() input:close() end)
    pcall(function() output:close() end)
    if not ok or length < 1024 then
        pcall(fs.remove, dst)
        return false
    end
    return true
end
local function gts20_download(app_id, game_name, video_id, title, as_custom)
    local key = gts20_valid_app(app_id)
    if not key then return nil, 'invalid_app_id' end
    if type(video_id) ~= 'string' or #video_id ~= 11 or not video_id:match('^[A-Za-z0-9_-]+$') then
        return nil, 'invalid_video_id'
    end
    local exe = gts20_exe()
    if not exe then return nil, 'yt_dlp_missing' end
    local old = cache[key]
    local slot = old and old.slot == 'b' and 'a' or 'b'
    local base = slot == 'b' and (key .. '_b') or key
    local temp_stem, stem_err = gts20_work_new('audio', key)
    if not temp_stem then return nil, stem_err end
    local function run_download_attempt()
    local cmd = exe .. ' --quiet --no-warnings --no-playlist --no-progress --no-part'
       .. ' --no-mtime --socket-timeout 20 --retries 2 --fragment-retries 2'
       .. ' --max-filesize 45M -f "bestaudio[ext=m4a]/bestaudio"'
       .. ' -o "' .. temp_stem .. '.%(ext)s"'
       .. ' "https://www.youtube.com/watch?v=' .. video_id .. '"'
    local ran, _, status = pcall(utils.exec, cmd)
    local source, ext, failure
    if not ran or status ~= 0 then
        failure = 'youtube_download_failed'
    else
        for _, e in ipairs({'m4a','webm','mp3','ogg','wav','flac'}) do
            local candidate = temp_stem .. '.' .. e
            if fs.exists(candidate) then source, ext = candidate, e; break end
        end
        if not source then
            failure = 'youtube_download_failed'
        else
            local checked, valid = pcall(function()
                local opened = io.open(source, 'rb')
                if not opened then return false end
                local size = opened:seek('end') or 0
                opened:close()
                return size >= 1024 and size <= 50 * 1024 * 1024
            end)
            if not checked or not valid then failure = 'invalid_audio_size' end
        end
    end
    if failure then return nil, failure end
    -- Manual confirmation keeps its proven atomic destination/backup writes.
    -- Buffer ONLY the newly selected track (<=50 MiB); prior songs/backup
    -- are snapshotted to scratch files instead of full Lua strings.
    local bytes = nil
    if as_custom then
        local opened = io.open(source, 'rb')
        if not opened then return nil, 'download_unreadable' end
        local ok_read, content = pcall(function() return opened:read('*a') end)
        pcall(function() opened:close() end)
        if not ok_read or not content or #content < 1024
            or #content > 50 * 1024 * 1024 then return nil, 'invalid_audio_size' end
        bytes = content
    end
    pcall(fs.create_directories, AUDIO_DIR)
    -- A manually confirmed choice is a CUSTOM theme, unlike automatic search.
    -- The same verified full download is reused; no nested FFI calls or second
    -- yt-dlp invocation, and the existing preview API remains untouched.
    if as_custom then
        -- Only use Lua locals defined ABOVE gts20_download. The v20.9.1 and
        -- v20.9.2 errors came from referencing late local declarations.
        local allowed = {m4a=true, webm=true, mp3=true, ogg=true, wav=true, flac=true}
        if not allowed[ext] then return nil, 'unsupported_format' end
        local filename = 'custom_' .. key .. '.' .. ext
        local destination = join(AUDIO_DIR, filename)
        local backup_path = join(CUSTOM_BACKUP_DIR, filename)
        local staged = join(AUDIO_DIR, 'gts20_custom_staged_' .. key .. '.' .. ext)
        pcall(fs.create_directories, CUSTOM_BACKUP_DIR)
        -- Validate a distinct staging file before touching an existing song.
        if not gts20_stream_copy(source, staged) then return nil, 'audio_write_failed' end
        local valid = looks_like_audio(staged)
        pcall(fs.remove, staged)
        if not valid then return nil, 'invalid_audio_file' end

        -- Preserve existing files and both state manifests until the new audio
        -- and its backup are safely written. A failed commit rolls back.
        local former_song = custom[key]
        local former_audio = fs.exists(destination) and (temp_stem .. '.oldcustom') or nil
        local former_backup = fs.exists(backup_path) and (temp_stem .. '.oldbackup') or nil
        -- Snapshot existing audio before any overwrite; failures are non-destructive.
        if former_audio and not gts20_stream_copy(destination, former_audio) then
            return nil, 'custom_snapshot_failed'
        end
        if former_backup and not gts20_stream_copy(backup_path, former_backup) then
            return nil, 'custom_snapshot_failed'
        end
        local former_custom_json = read_file(CUSTOM_FILE)
        local former_backup_json = read_file(CUSTOM_BACKUP_FILE)
        local function restore(path, previous)
            if previous then
                if path == destination or path == backup_path then
                    return gts20_stream_copy(previous, path)
                end
                return write_file_atomic(path, previous)
            end
            pcall(fs.remove, path)
            return true
        end
        local function rollback()
            custom[key] = former_song
            restore(destination, former_audio)
            restore(backup_path, former_backup)
            restore(CUSTOM_FILE, former_custom_json)
            restore(CUSTOM_BACKUP_FILE, former_backup_json)
        end
        if not write_file_atomic(destination, bytes) or not looks_like_audio(destination) then
            restore(destination, former_audio)
            return nil, 'custom_write_failed'
        end
        if not write_file_atomic(backup_path, bytes) or not looks_like_audio(backup_path) then
            restore(destination, former_audio)
            restore(backup_path, former_backup)
            return nil, 'custom_backup_failed'
        end

        local stamp = os.time()
        local selected_title = sanitize_text(title or 'YouTube theme', 100)
        custom[key] = {file=filename, title=selected_title,
            name=sanitize_text(game_name or '', 200), ts=stamp}
        local state = safe_encode(custom)
        if not state or not write_file_atomic(CUSTOM_FILE, state)
            or not write_file_atomic(CUSTOM_BACKUP_FILE, state) then
            rollback()
            return nil, 'custom_metadata_failed'
        end
        custom_list_cache = nil
        -- Only after the custom replacement is persisted, retire old formats.
        for oldext in pairs(allowed) do
            if oldext ~= ext then
                pcall(fs.remove, join(AUDIO_DIR, 'custom_' .. key .. '.' .. oldext))
                pcall(fs.remove, join(CUSTOM_BACKUP_DIR, 'custom_' .. key .. '.' .. oldext))
            end
        end
        -- Clear the automatic download only after the manual override succeeds.
        local old_cache = cache[key]
        if old_cache then
            cache[key] = nil
            save_cache()
            local old_name = tostring(old_cache.file or '')
            local matching_name = (old_name:match('^(%d+)%.[%w]+$') == key)
                or (old_name:match('^(%d+)_b%.[%w]+$') == key)
            if matching_name and old_name ~= filename then
                pcall(fs.remove, join(AUDIO_DIR, old_name))
                gts_auto_forget_audio(key, old_name)
            end
        end
        return {ok=true, url=LOOPBACK_BASE .. filename .. '?v=' .. stamp,
            title=selected_title, cached=false, custom=true, source='youtube_manual'}, nil
    end
    local filename = base .. '.' .. ext
    local dest = join(AUDIO_DIR, filename)
    if not gts20_stream_copy(source, dest) then return nil, 'audio_write_failed' end
    local valid = looks_like_audio(dest)
    if not valid then pcall(fs.remove, dest); return nil, 'invalid_audio_file' end
    -- Keep a durable copy before publishing a new automatic cache entry.
    if not gts_auto_backup_audio(key, filename) then
        pcall(fs.remove, dest)
        return nil, 'persistent_cache_backup_failed'
    end
    -- Update cache only once the new file is complete and validated.
    local timestamp = os.time()
    cache[key] = {file = filename, title = sanitize_text(title or 'YouTube theme'),
      name = sanitize_text(game_name), ts = timestamp, slot = slot,
      source = 'youtube_v20', video_id = video_id}
    if not save_cache() then
        -- Keep the already validated audio in place: the durable index may
        -- already contain the new entry and can recover the next startup.
        return nil, 'cache_metadata_save_failed'
    end
    return {ok = true, url = LOOPBACK_BASE .. filename .. '?v=' .. timestamp,
      title = cache[key].title, cached = false, source = 'youtube_v20'}, nil
    end
    local ran_ok, result, reason = pcall(run_download_attempt)
    gts20_work_cleanup(temp_stem, 'audio')
    if not ran_ok then return nil, 'download_commit_failed' end
    return result, reason
end
local function resolve_theme(app_id, force_refresh, game_name, exclude)
    if resolve_busy then return json.encode({ok = false, error = 'busy'}) end
    resolve_busy = true
    local ok, result = pcall(function()
        local key = gts20_valid_app(app_id)
        if not key then return {ok=false, error='invalid_app_id'} end
        if ignored[key] then return {ok=false, error='ignored'} end
        game_name = native_string(game_name or '', 300)
        if game_name == '' then return {ok=false, error='missing_game_name'} end
        local rerolling = (type(exclude) == 'string' and exclude ~= '')
        local custom_song = custom[key]
        if custom_song and custom_song.file and fs.exists(join(AUDIO_DIR, custom_song.file)) then
            return {ok=true, url=LOOPBACK_BASE .. custom_song.file .. '?v=' .. tostring(custom_song.ts or 0),
              title=custom_song.title, cached=true, custom=true}
        end
        local entry = cache[key]
        if not force_refresh and not rerolling and entry and entry.source == 'youtube_v20'
            and entry.file and fs.exists(join(AUDIO_DIR, entry.file)) then
            return {ok=true, url=LOOPBACK_BASE .. entry.file .. '?v=' .. tostring(entry.ts or 0),
              title=entry.title, cached=true}
        end
        local items, err = gts20_candidates(app_id, game_name, false)
        if not items then
            if err == 'youtube_no_results' then
                local fallback = try_fallback()
                if fallback then return safe_decode(fallback) end
            end
            return {ok=false, error=err or 'youtube_search_failed'}
        end
        local excludes = build_exclude(exclude)
        local eligible = {}
        for _, item in ipairs(items) do
            if not is_excluded(excludes, item.title) then eligible[#eligible+1] = item end
        end
        if #eligible == 0 then return {ok=false, error='youtube_no_alternative'} end
        -- Take the highest-ranked candidate that satisfies the explicit
        -- game-title + OST/soundtrack rule. No score gap is required.
        local confident
        for _, item in ipairs(eligible) do
            if item.qualified then confident = item; break end
        end
        if confident then
            local downloaded, download_err = gts20_download(app_id, game_name, confident.id, confident.title)
            if downloaded then return downloaded end
            return {ok=false, error=download_err or 'youtube_download_failed', candidates=eligible}
        end
        -- Explicit approval required before downloading any low-confidence match.
        return {ok=false, error='youtube_needs_confirmation', candidates=eligible}
    end)
    resolve_busy = false
    if not ok then
        logger:warn('v20 YouTube resolve crashed: ' .. tostring(result))
        return json.encode({ok=false, error='internal_error'})
    end
    return json.encode(result)
end

---@ffi
---Find ranked YouTube candidates, optionally using a manually entered query.
---@param app_id number Steam app id
---@param game_name string Steam game name (for assignment and automatic searches)
---@param custom_query string Optional text to search instead of generated game queries
---@return string JSON {ok, candidates, error}
function youtube_v20_search(app_id, game_name, custom_query)
    if resolve_busy or io_busy then return json.encode({ok=false, error='busy'}) end
    local key = gts20_valid_app(app_id)
    if not key then return json.encode({ok=false,error='invalid_app_id'}) end
    if ignored[key] then return json.encode({ok=false,error='ignored'}) end
    game_name = native_string(game_name or '', 300)
    local requested = type(custom_query) == 'string' and custom_query ~= ''
    local query = ''
    if requested then
        query = gts20_manual_query(custom_query)
        if not query then return json.encode({ok=false,error='invalid_custom_search'}) end
    end
    -- Explicit searches bypass the automatic result cache; normal searches
    -- still reuse it. Session IDs remain authorized for preview/confirmation.
    local ok, items, err = pcall(gts20_candidates, app_id, game_name, requested, query)
    if not ok then return json.encode({ok=false,error='internal_error'}) end
    if not items then return json.encode({ok=false,error=err}) end
    return json.encode({ok=true, candidates=items})
end

---@ffi
---Assign a manually approved YouTube result as a custom track.
---@param app_id number Steam app id
---@param game_name string Steam game name
---@param video_id string One of the returned candidate IDs
---@return string JSON {ok, error}
function youtube_v20_assign(app_id, game_name, video_id)
    if resolve_busy or io_busy then return json.encode({ok=false,error='busy'}) end
    local key = gts20_valid_app(app_id)
    if not key or ignored[key] then return json.encode({ok=false,error='ignored_or_invalid'}) end
    gts20_prune_sessions()
    local session = gts20_sessions[key]
    if not session or session.name ~= game_name or os.time() - session.ts >= 900 then
        return json.encode({ok=false,error='search_expired'})
    end
    local chosen
    for _, item in ipairs(session.items) do
        if item.id == video_id then chosen = item; break end
    end
    if not chosen then return json.encode({ok=false,error='not_in_search_results'}) end
    gts20_touch_session(session)
    resolve_busy = true
    local ok, result, err = pcall(gts20_download, app_id, game_name, video_id, chosen.title, true)
    if ok and result and result.ok then gts20_sessions[key] = nil end
    resolve_busy = false
    if not ok then logger:warn('v20 YouTube assignment failed: ' .. tostring(result)); return json.encode({ok=false,error='internal_error'}) end
    return json.encode(result or {ok=false,error=err or 'download_failed'})
end


-- v20.3: Local, deliberately short-lived 15-second audio previews.
-- Preview files never enter 'cache', 'custom', or the full-track assignment path.
-- Previews are cached only while the YouTube picker is in use. Each
-- candidate has its own final MP3, so comparing results never redownloads it.
-- A bounded per-game cache (max 16 short clips) protects disk space if a
-- picker is kept open across multiple searches. Reboot removes orphan files.
-- Keep private preview helpers in a separate function prototype. Lua limits
-- each function (including the top-level chunk) to 200 simultaneously active
-- locals. Do not promote them into the large plugin main chunk.
-- The published @ffi endpoint functions below MUST remain top-level globals.
GTS20_PREVIEW_CORE = (function()
local gts20_preview_current = {} -- [app_id] = {[video_id] = true}
local gts20_preview_order = {}   -- [app_id] = {oldest_video_id, ...}
local gts20_preview_dirty = {}   -- [safe filename] = true
local gts20_preview_busy = false
local gts20_preview_registry = join(DATA_DIR, 'gts20_preview_registry.json')
local gts20_preview_limit = 16

local function gts20_preview_filename(key, video_id)
    return 'gts20_preview_' .. key .. '_' .. video_id .. '.mp3'
end

local function gts20_preview_valid_video(video_id)
    return type(video_id) == 'string' and #video_id == 11
       and video_id:match('^[A-Za-z0-9_-]+$') ~= nil
end

local function gts20_preview_touch(key, video_id)
    local by_game = gts20_preview_current[key] or {}
    local order = gts20_preview_order[key] or {}
    by_game[video_id] = true
    for index = #order, 1, -1 do
        if order[index] == video_id then table.remove(order, index) end
    end
    order[#order + 1] = video_id
    gts20_preview_current[key], gts20_preview_order[key] = by_game, order
end

-- A successful remove is confirmed by existence, not by fs.remove's return
-- value (filesystem implementations can return nil even on success).
local function gts20_preview_remove(path)
    local exists_ok, present = pcall(fs.exists, path)
    if not exists_ok then return false end
    if not present then return true end
    for _ = 1, 2 do
        pcall(fs.remove, path)
        local check_ok, still_present = pcall(fs.exists, path)
        if check_ok and not still_present then return true end
    end
    return false
end

local function gts20_preview_registry_save()
    if next(gts20_preview_dirty) then
        if not pcall(ensure_data_dir) then return false end
        local encoded_ok, encoded = pcall(json.encode, gts20_preview_dirty)
        if not encoded_ok then return false end
        local ok, saved = pcall(write_file, gts20_preview_registry, encoded)
        return ok and saved == true
    end
    return gts20_preview_remove(gts20_preview_registry)
end

local function gts20_preview_clear_file(key, video_id, defer_save)
    -- The same result can be selected again; clearing one result is scoped
    -- to its own file and cannot remove another candidate's clip.
    if not gts20_preview_valid_video(video_id) then return false, 'invalid_video_id' end
    local filename = gts20_preview_filename(key, video_id)
    local removed = gts20_preview_remove(join(AUDIO_DIR, filename))
    if removed then
        local by_game = gts20_preview_current[key]
        if by_game then
            by_game[video_id] = nil
            if not next(by_game) then gts20_preview_current[key] = nil end
        end
        local order = gts20_preview_order[key]
        if order then
            for index = #order, 1, -1 do
                if order[index] == video_id then table.remove(order, index) end
            end
            if #order == 0 then gts20_preview_order[key] = nil end
        end
        gts20_preview_dirty[filename] = nil
    else
        gts20_preview_dirty[filename] = true
    end
    local persisted = defer_save or gts20_preview_registry_save()
    if not removed then return false, 'preview_cleanup_failed' end
    if not persisted then return false, 'preview_registry_write_failed' end
    return true
end

-- v3.0.0 pre-release audit: confine yt-dlp/FFmpeg preview intermediates.
-- No automatic theme, custom theme, or persistent-backup file lives here.
local gts20_preview_scratch_dir = join(DATA_DIR, 'gts20_preview_scratch')
local gts20_preview_job_sequence = 0

local function gts20_preview_scan_files(dir, matches, on_result)
    if not fs or type(fs.list) ~= 'function' then return false end
    local ok, entries = pcall(fs.list, dir)
    if not ok or type(entries) ~= 'table' then return false end
    for _, item in ipairs(entries) do
        local filename = type(item) == 'table' and item.name or nil
        -- Never interpret directory names, nested paths, or unrelated files
        -- as our scratch outputs, even if a filesystem API returns them.
        if type(item) == 'table' and item.is_file and type(filename) == 'string'
           and not filename:find('/', 1, true)
           and not filename:find(string.char(92), 1, true)
           and matches(filename) then
            local removed = gts20_preview_remove(join(dir, filename))
            if on_result then on_result(filename, removed) end
        end
    end
    return true
end

-- No active picker exists after a process restart; clear legacy and new
-- preview files even when registry writes were interrupted. Never scan
-- cache.json, custom-song paths, or automatic-theme backup directories.
do
    local function valid_preview_name(name)
        local legacy = name:match('^gts20_preview_(%d+)%.mp3$')
        if legacy and gts20_valid_app(legacy) then return true end
        local app, video = name:match('^gts20_preview_(%d+)_([A-Za-z0-9_-]+)%.mp3$')
        return app ~= nil and gts20_valid_app(app) ~= nil and gts20_preview_valid_video(video)
    end
    local read_ok, registry_text = pcall(read_file, gts20_preview_registry)
    local decoded_ok, old = pcall(safe_decode, read_ok and (registry_text or '') or '')
    if decoded_ok and type(old) == 'table' then
        for name, marked in pairs(old) do
            if marked then
                -- Previous builds indexed old previews by numeric AppID.
                local filename = valid_preview_name(name) and name
                    or (gts20_valid_app(name) and ('gts20_preview_' .. name .. '.mp3'))
                if filename then
                    local removed = gts20_preview_remove(join(AUDIO_DIR, filename))
                    gts20_preview_dirty[name] = removed and nil or true
                end
            end
        end
    end
    local scanned = gts20_preview_scan_files(AUDIO_DIR, valid_preview_name,
        function(name, removed)
            gts20_preview_dirty[name] = removed and nil or true
        end)
    if not scanned then
        pcall(function() logger:warn('Preview startup cleanup could not enumerate preview clips; registry-only recovery remains active') end)
    end
    if not gts20_preview_registry_save() then
        pcall(function() logger:warn('Preview cleanup registry update failed; will retry when possible') end)
    end
end

-- A picker session finishes on Confirm, Cancel, Close, app change, or
-- component disposal. Work only on this AppID's exact temporary filenames.
local function gts20_preview_clear_app(key)
    local ids = {}
    for video in pairs(gts20_preview_current[key] or {}) do ids[video] = true end
    local prefix = 'gts20_preview_' .. key .. '_'
    for filename in pairs(gts20_preview_dirty) do
        if filename:sub(1, #prefix) == prefix then
            local video = filename:sub(#prefix + 1):match('^([A-Za-z0-9_-]+)%.mp3$')
            if gts20_preview_valid_video(video) then ids[video] = true end
        end
    end
    local ok, entries = pcall(fs.list, AUDIO_DIR)
    if ok and type(entries) == 'table' then
        for _, item in ipairs(entries) do
            if type(item) == 'table' and item.is_file and type(item.name) == 'string'
               and item.name:sub(1, #prefix) == prefix then
                local video = item.name:sub(#prefix + 1):match('^([A-Za-z0-9_-]+)%.mp3$')
                if gts20_preview_valid_video(video) then ids[video] = true end
            end
        end
    end
    local all_removed = true
    for video in pairs(ids) do
        local removed = gts20_preview_clear_file(key, video, true)
        if not removed then all_removed = false end
    end
    -- Older releases used a single final MP3 per AppID.
    local legacy = 'gts20_preview_' .. key .. '.mp3'
    local legacy_removed = gts20_preview_remove(join(AUDIO_DIR, legacy))
    if legacy_removed then gts20_preview_dirty[key] = nil
    else gts20_preview_dirty[key] = true end
    local persisted = gts20_preview_registry_save()
    if not all_removed or not legacy_removed then return false, 'preview_cleanup_failed' end
    if not persisted then return false, 'preview_registry_write_failed' end
    return true
end

local function gts20_preview_is_orphan_name(filename, legacy)
    -- Legacy v20.3 output lived immediately in DATA_DIR and had a two-part
    -- suffix; new outputs have a four-part suffix in the scratch directory.
    if legacy then return filename:match('^gts20_preview_build_%d+_%d+%..+$') ~= nil end
    return filename:match('^gts20_preview_build_%d+_%d+_%d+_%d+%..+$') ~= nil
end

-- On startup the previous instance is no longer running. Sweep only our
-- precisely named intermediates, including unknown ffmpeg/yt-dlp sidecars.
-- In particular do NOT touch AUDIO_DIR, cache.json, or backup directories.
do
    gts20_preview_scan_files(gts20_preview_scratch_dir, function(name)
        return gts20_preview_is_orphan_name(name, false)
    end)
    gts20_preview_scan_files(DATA_DIR, function(name)
        return gts20_preview_is_orphan_name(name, true)
    end)
end

local function gts20_preview_cleanup_job(job_name, base)
    local prefix = job_name .. '.'
    -- Enumeration covers ffmpeg temporary names (.temp.*, .part, .info.json,
    -- and formats not known at development time).
    gts20_preview_scan_files(gts20_preview_scratch_dir, function(name)
        return name:sub(1, #prefix) == prefix
    end)
    -- Fallback when listing is unavailable: remove common output formats.
    for _, ext in ipairs({'m4a', 'webm', 'mp3', 'ogg', 'opus', 'mp4', 'mkv',
        'wav', 'flac', 'part', 'ytdl', 'info.json', 'mp3.part', 'm4a.part',
        'webm.part', 'temp.mp3', 'temp.m4a'}) do
        pcall(fs.remove, base .. '.' .. ext)
    end
end

local function gts20_preview_download(key, video_id)
    local exe = gts20_exe()
    if not exe then return nil, 'yt_dlp_missing' end
    ensure_data_dir()
    local ok_dir = pcall(fs.create_directories, gts20_preview_scratch_dir)
    if not ok_dir or not fs.exists(gts20_preview_scratch_dir) then
        return nil, 'preview_temp_dir_unavailable'
    end
    -- Seconds-resolution names collided on rapid retries; a per-process
    -- sequence and randomized suffix keep attempts distinct across restarts.
    gts20_preview_job_sequence = gts20_preview_job_sequence + 1
    local job_name = 'gts20_preview_build_' .. key .. '_' .. tostring(os.time())
        .. '_' .. tostring(gts20_preview_job_sequence)
        .. '_' .. tostring(math.floor(os.clock() * 1000000))
        .. tostring(math.random(100000, 999999))
    local base = join(gts20_preview_scratch_dir, job_name)
    if not gts20_safe_path(base) then return nil, 'unsupported_install_path' end
    local ffmpeg_in_data = join(DATA_DIR, 'ffmpeg.exe')
    local ffmpeg_flag = ''
    if fs.exists(ffmpeg_in_data) then
        if not gts20_safe_path(ffmpeg_in_data) then return nil, 'unsupported_install_path' end
        ffmpeg_flag = ' --ffmpeg-location "' .. ffmpeg_in_data .. '"'
    end
    -- yt-dlp delegates section downloads and mp3 transcoding to ffmpeg.
    -- The *0-15 range is deliberately applied BEFORE audio extraction.
    local cmd = exe .. ' --quiet --no-warnings --no-playlist --no-progress --no-part --no-mtime'
       .. ' --socket-timeout 20 --retries 2 --fragment-retries 2'
       .. ' --download-sections "*0-15" -f "bestaudio[ext=m4a]/bestaudio"'
       .. ' --extract-audio --audio-format mp3 --audio-quality 5'
       .. ffmpeg_flag .. ' -o "' .. base .. '.%(ext)s"'
       .. ' "https://www.youtube.com/watch?v=' .. video_id .. '"'
    -- Catch errors thrown by exec, so even that failure path gets cleanup.
    local ran, _, status = pcall(utils.exec, cmd)
    local output = base .. '.mp3'
    if not ran or status ~= 0 or not fs.exists(output) then
        gts20_preview_cleanup_job(job_name, base)
        local ffmpeg_ran, _, ffmpeg_status = pcall(utils.exec, 'ffmpeg -version')
        if (not ffmpeg_ran or ffmpeg_status ~= 0) and not fs.exists(ffmpeg_in_data) then
            return nil, 'ffmpeg_missing_or_not_on_path'
        end
        return nil, 'preview_download_failed'
    end
    local file = io.open(output, 'rb')
    if not file then
        gts20_preview_cleanup_job(job_name, base)
        return nil, 'preview_unreadable'
    end
    local size = file:seek('end') or 0
    file:seek('set', 0)
    -- Approximately 15 seconds of MP3 should be much less than 2 MiB.
    local bytes = (size > 1024 and size <= 2 * 1024 * 1024) and file:read('*a') or nil
    file:close()
    gts20_preview_cleanup_job(job_name, base)
    if not bytes then return nil, 'preview_invalid_audio_size' end
    pcall(fs.create_directories, AUDIO_DIR)
    local filename = gts20_preview_filename(key, video_id)
    local target = join(AUDIO_DIR, filename)
    local order = gts20_preview_order[key] or {}
    if #order >= gts20_preview_limit then
        local cleared, why = gts20_preview_clear_file(key, order[1])
        if not cleared then return nil, why end
    end
    if not write_file(target, bytes) then
        gts20_preview_remove(target)
        return nil, 'preview_write_failed'
    end
    if not looks_like_audio(target) then
        pcall(fs.remove, target)
        return nil, 'preview_invalid_audio_file'
    end
    gts20_preview_touch(key, video_id)
    gts20_preview_dirty[filename] = true
    if not gts20_preview_registry_save() then
        -- Never serve an untracked clip: if it cannot be removed right now,
        -- startup's exact-filename sweep can still recover it.
        gts20_preview_clear_file(key, video_id)
        return nil, 'preview_registry_write_failed'
    end
    -- The same Steam loopback host used by normal theme playback.
    return LOOPBACK_BASE .. filename .. '?v=' .. tostring(os.time()), nil
end

-- Only one namespaced table escapes the private helper function. No additional
-- main-chunk locals are introduced, and no new global helper functions exist.
return {
    valid_video = gts20_preview_valid_video,
    filename = gts20_preview_filename,
    touch = gts20_preview_touch,
    clear_file = gts20_preview_clear_file,
    clear_app = gts20_preview_clear_app,
    download = gts20_preview_download,
    busy = function() return gts20_preview_busy end,
    set_busy = function(value) gts20_preview_busy = value end,
}
end)()

---@ffi
---Download only seconds 0-15 of an approved search candidate for local preview.
---@param app_id number Steam app id
---@param video_id string Candidate ID returned by youtube_v20_search
---@return string JSON {ok, url, error}
function youtube_v20_preview(app_id, video_id)
    local key = gts20_valid_app(app_id)
    if not key then return json.encode({ok=false, error='invalid_app_id'}) end
    if ignored[key] then return json.encode({ok=false, error='ignored'}) end
    if not GTS20_PREVIEW_CORE.valid_video(video_id) then
        return json.encode({ok=false, error='invalid_video_id'})
    end
    gts20_prune_sessions()
    local session = gts20_sessions[key]
    if not session or os.time() - session.ts >= 900 then
        return json.encode({ok=false, error='search_expired'})
    end
    local authorized = false
    for _, item in ipairs(session.items) do
        if item.id == video_id then authorized = true; break end
    end
    if not authorized then return json.encode({ok=false, error='not_in_search_results'}) end
    gts20_touch_session(session)
    if resolve_busy or io_busy or GTS20_PREVIEW_CORE.busy() then
        return json.encode({ok=false, error='busy'})
    end
    local filename = GTS20_PREVIEW_CORE.filename(key, video_id)
    if fs.exists(join(AUDIO_DIR, filename)) then
        if looks_like_audio(join(AUDIO_DIR, filename)) then
            GTS20_PREVIEW_CORE.touch(key, video_id)
            return json.encode({ok=true, url=LOOPBACK_BASE .. filename
                .. '?v=' .. tostring(os.time()), seconds=15, cached=true})
        end
        local cleared, why = GTS20_PREVIEW_CORE.clear_file(key, video_id)
        if not cleared then return json.encode({ok=false, error=why}) end
    end
    GTS20_PREVIEW_CORE.set_busy(true)
    local ok, url, err = pcall(GTS20_PREVIEW_CORE.download, key, video_id)
    GTS20_PREVIEW_CORE.set_busy(false)
    if not ok then
        logger:warn('v20.3 preview generation failed: ' .. tostring(url))
        return json.encode({ok=false, error='internal_preview_error'})
    end
    if not url then return json.encode({ok=false, error=err or 'preview_failed'}) end
    return json.encode({ok=true, url=url, seconds=15})
end

---@ffi
---Remove the temporary clip for a specific selected preview, if still current.
---@param app_id number Steam app id
---@param video_id string Previously selected candidate ID
---@return string JSON {ok}
function youtube_v20_preview_clear(app_id, video_id)
    local key = gts20_valid_app(app_id)
    if not key then return json.encode({ok=false, error='invalid_app_id'}) end
    if not GTS20_PREVIEW_CORE.valid_video(video_id) then
        return json.encode({ok=false, error='invalid_video_id'})
    end
    if GTS20_PREVIEW_CORE.busy() then return json.encode({ok=false, error='busy'}) end
    local cleared, clear_err = GTS20_PREVIEW_CORE.clear_file(key, video_id)
    if not cleared then return json.encode({ok=false, error=clear_err}) end
    return json.encode({ok=true})
end

---@ffi
---Remove every temporary 15-second clip for this game when selection ends.
---@param app_id number Steam app id
---@return string JSON {ok, error}
function youtube_v20_preview_clear_session(app_id)
    local key = gts20_valid_app(app_id)
    if not key then return json.encode({ok=false, error='invalid_app_id'}) end
    if GTS20_PREVIEW_CORE.busy() then return json.encode({ok=false, error='busy'}) end
    local cleared, clear_err = GTS20_PREVIEW_CORE.clear_app(key)
    if not cleared then return json.encode({ok=false, error=clear_err}) end
    return json.encode({ok=true})
end
---@ffi
---Resolve the theme song for a game, downloading it if needed.
---@param app_id number Steam app id
---@param game_name string Display name of the game
---@param force_refresh boolean Bypass the on-disk cache
---@return string JSON { ok, url, title, cached, custom }
function get_theme_audio(app_id, game_name, force_refresh)
    return resolve_theme(app_id, force_refresh, game_name, nil)
end

---@ffi
---Resolve a different theme song, skipping the excluded titles.
---@param app_id number Steam app id
---@param game_name string Display name of the game
---@param force_refresh boolean Bypass the on-disk cache
---@param exclude string JSON array of titles to skip
---@return string JSON { ok, url, title, cached, custom }
function reroll_theme(app_id, game_name, force_refresh, exclude)
    return resolve_theme(app_id, force_refresh, game_name, exclude)
end

---@ffi
---Delete any downloaded theme audio for a game.
---@param app_id number Steam app id
---@return string JSON { ok }
function invalidate_audio(app_id)
    local key = tostring(app_id)
    if fs and fs.remove then
    for _, e in ipairs(AUDIO_EXTS) do
        pcall(fs.remove, join(AUDIO_DIR, key .. "." .. e))
        pcall(fs.remove, join(AUDIO_DIR, key .. "_b." .. e))
    end
end
    cache[key] = nil
    save_cache()
    return json.encode({ ok = true })
end

local CUSTOM_EXTS = {
    mp3 = "mp3", m4a = "m4a", mp4 = "m4a", aac = "m4a",
    ogg = "ogg", oga = "ogg", opus = "ogg", webm = "webm",
    wav = "wav", flac = "flac",
}

local function custom_ext(filename)
    local ext = tostring(filename or ""):match("%.([%w]+)$")
    if not ext then return nil end
    return CUSTOM_EXTS[ext:lower()]
end

---@ffi
---List games that have a custom music file set.
---@return string JSON { ok, items }
function get_custom_list()
  return run_io("get_custom_list", function()
    if custom_list_cache then return custom_list_cache end
    local items, count = {}, 0
    for key, entry in pairs(custom) do
      if entry and entry.file and fs and fs.exists and fs.exists(join(AUDIO_DIR, entry.file)) then
        items[tostring(key)] = { title = sanitize_text(entry.title or ""), name = sanitize_text(entry.name or "") }
        count = count + 1
        if count >= MAX_LIST_ITEMS then break end
      end
    end
    custom_list_cache = json.encode({ ok = true, items = items })
    return custom_list_cache
  end)
end
---@ffi
---List games whose auto-search is muted.
---@return string JSON { ok, items }
function get_ignored_list()
    return json.encode({ ok = true, items = ignored })
end

---@ffi
---Mute or unmute auto-search for a game.
---@param app_id number Steam app id
---@param value boolean true to mute
---@return string JSON { ok }
function set_ignored(app_id, value)
    local key = tostring(app_id)
    if key == "" or key == "nil" then return json.encode({ ok = false, error = "missing_app_id" }) end
    if value then ignored[key] = true else ignored[key] = nil end
    save_ignored()
    return json.encode({ ok = true })
end

local upload_sessions = {}

local function copy_file(src, dst)
    local f = io.open(src, "rb")
    if not f then return false end
    local data = f:read("*a")
    f:close()
    if not data then return false end
    return write_file(dst, data)
end

local function sync_custom_backup()
    if not fs then return end
    pcall(fs.create_directories, CUSTOM_BACKUP_DIR)
    local s = safe_encode(custom)
    if s then write_file_atomic(CUSTOM_BACKUP_FILE, s) end
    for _, entry in pairs(custom) do
        if type(entry) == "table" and entry.file then
            local src = join(AUDIO_DIR, entry.file)
            local dst = join(CUSTOM_BACKUP_DIR, entry.file)
            if fs.exists and fs.exists(src) and not fs.exists(dst) then copy_file(src, dst) end
        end
    end
end

local function restore_custom_backup()
    if not fs then return end
    pcall(fs.create_directories, AUDIO_DIR)
    if fs.exists and fs.exists(CUSTOM_BACKUP_FILE) then
        local backup = scrub_state(safe_decode(read_file(CUSTOM_BACKUP_FILE)) or {})
        local changed = false
        for key, entry in pairs(backup) do
            if type(entry) == "table" and type(entry.file) == "string" and entry.file ~= "" then
                local src = join(CUSTOM_BACKUP_DIR, entry.file)
                if fs.exists(src) then
                    local dst = join(AUDIO_DIR, entry.file)
                    if not fs.exists(dst) then copy_file(src, dst) end
                    if not custom[key] then
                        custom[key] = {
                            file = entry.file,
                            title = sanitize_text(tostring(entry.title or "")),
                            name = sanitize_text(tostring(entry.name or "")),
                            ts = tonumber(entry.ts) or os.time(),
                        }
                        changed = true
                    end
                end
            end
        end
        if changed then
            save_custom()
            custom_list_cache = nil
        end
    end
    local fb = settings.fallback_file
    if type(fb) == "string" and fb ~= "" then
        local src = join(CUSTOM_BACKUP_DIR, fb)
        local dst = join(AUDIO_DIR, fb)
        if fs.exists(src) and not fs.exists(dst) then copy_file(src, dst) end
    end
    sync_custom_backup()
end

local function store_custom(app_id, game_name, filename, title, data, ext_hint, title_b64, name_b64)
    if not (fs and fs.create_directories) then return json.encode({ ok = false, error = "fs_unsupported" }) end
    local key = tostring(app_id)
    if key == "" or key == "nil" then return json.encode({ ok = false, error = "missing_app_id" }) end
    local ext
    if ext_hint and tostring(ext_hint) ~= "" then ext = CUSTOM_EXTS[tostring(ext_hint):lower()] end
    if not ext then ext = custom_ext(filename) end
    if not ext then return json.encode({ ok = false, error = "unsupported_format" }) end
    local resolved_title
    if title_b64 and tostring(title_b64) ~= "" then local t = base64_decode(title_b64); if t and t ~= "" then resolved_title = t end end
    local resolved_name
    if name_b64 and tostring(name_b64) ~= "" then local n = base64_decode(name_b64); if n and n ~= "" then resolved_name = n end end
    local bytes = base64_decode(data)
    if #bytes < 1024 then return json.encode({ ok = false, error = "file_too_small" }) end
    if #bytes > 50 * 1024 * 1024 then return json.encode({ ok = false, error = "file_too_large" }) end
    pcall(fs.create_directories, AUDIO_DIR)
    local fname = "custom_" .. key .. "." .. ext
    for e in pairs(CUSTOM_EXTS) do pcall(fs.remove, join(AUDIO_DIR, "custom_" .. key .. "." .. e)) end
    if not write_file(join(AUDIO_DIR, fname), bytes) then return json.encode({ ok = false, error = "write_failed" }) end
    local clean_title = sanitize_text((tostring(resolved_title or ""):gsub("%.[%w]+$", "")))
    if clean_title == "" then clean_title = "Custom track" end
    resolved_name = sanitize_text(resolved_name or "")
    local ts = os.time()
    custom[key] = { file = fname, title = clean_title, name = resolved_name or "", ts = ts }
    save_custom()
    sync_custom_backup()
    custom_list_cache = nil
    local url = LOOPBACK_BASE .. fname .. "?v=" .. tostring(ts)
    return json.encode({ ok = true, url = url })
end

-- Windows-only custom YouTube audio assignment. yt-dlp must be installed locally.
-- Downloads a single permitted video and registers it via the same custom mapping
-- used by local-file uploads. Do not accept raw shell arguments from the UI.
local function gts_video_id(url)
    if type(url) ~= 'string' or #url > 1024 then return nil end
    url = url:match('^%s*(.-)%s*$')
    local host, rest = url:match('^https?://([^/]+)(/.*)$')
    if not host or not rest then return nil end
    host = host:lower()
    local id
    if host == 'youtu.be' or host == 'www.youtu.be' then
        id = rest:match('^/([A-Za-z0-9_-]+)')
    elseif host == 'youtube.com' or host == 'www.youtube.com' or host == 'm.youtube.com'
        or host == 'music.youtube.com' then
        id = rest:match('^/watch%?.-[?&]v=([A-Za-z0-9_-]+)')
            or rest:match('^/watch%?v=([A-Za-z0-9_-]+)')
            or rest:match('^/shorts/([A-Za-z0-9_-]+)')
            or rest:match('^/live/([A-Za-z0-9_-]+)')
    end
    if id and #id == 11 then return id end
    return nil
end

---@ffi
---Download authorized audio from one YouTube video with locally installed yt-dlp.
---@param app_id number Steam app id
---@param game_name string Game name
---@param video_url string Youtube URL
---@return string JSON { ok, title, error }
function set_youtube_custom_music(app_id, game_name, video_url)
    if SEP ~= '\\' then return json.encode({ok=false, error='windows_only'}) end
    if not fs or not utils or type(utils.exec) ~= 'function' then
        return json.encode({ok=false, error='exec_unsupported'})
    end
    local key = tostring(app_id or '')
    if not key:match('^%d+$') or #key > 12 or tonumber(key) == 0 then
        return json.encode({ok=false, error='invalid_app_id'})
    end
    local id = gts_video_id(video_url)
    if not id then return json.encode({ok=false, error='invalid_youtube_url'}) end
    local function result(ok, error, title)
        return json.encode({ok=ok, error=error, title=title})
    end
    local ok, res = pcall(function()
        ensure_data_dir()
        -- Prefer a user-provided executable in the persistent data directory,
        -- otherwise resolve yt-dlp from the Windows PATH.
        local executable = 'yt-dlp'
        local local_exe = join(DATA_DIR, 'yt-dlp.exe')
        if fs.exists(local_exe) then executable = '"' .. local_exe .. '"' end
        local check, status = utils.exec(executable .. ' --version')
        if status ~= 0 then return result(false, 'yt_dlp_missing') end

        local nonce = tostring(os.time()) .. '_' .. tostring(math.random(100000,999999))
        local stem = join(DATA_DIR, 'gts_youtube_' .. key .. '_' .. nonce)
        -- Steam and Millennium installation paths are local, but Windows cmd.exe
        -- would interpret these characters even inside double quotes.
        if stem:find('["%%!\r\n]') then return result(false, 'unsupported_install_path') end
        local template = stem .. '.%(ext)s'
        local canonical = 'https://www.youtube.com/watch?v=' .. id
        local cmd = executable
          .. ' --quiet --no-warnings --no-playlist --no-progress --no-part'
          .. ' --no-mtime --socket-timeout 20 --retries 2 --fragment-retries 2'
          .. ' --max-filesize 45M --write-info-json'
          .. ' -f "bestaudio[ext=m4a]/bestaudio"'
          .. ' -o "' .. template .. '" "' .. canonical .. '"'
        local _, download_status = utils.exec(cmd)
        local source, ext
        for _, candidate in ipairs({'m4a', 'webm', 'opus', 'ogg', 'mp3', 'aac', 'flac', 'wav'}) do
            local file = stem .. '.' .. candidate
            if fs.exists(file) then source, ext = file, candidate; break end
        end
        local metadata_file = stem .. '.info.json'
        if download_status ~= 0 or not source then
            if source then pcall(fs.remove, source) end
            pcall(fs.remove, metadata_file)
            return result(false, 'download_failed')
        end
        local metadata = safe_decode(read_file(metadata_file) or '')
        pcall(fs.remove, metadata_file)
        local file = io.open(source, 'rb')
        if not file then pcall(fs.remove, source); return result(false, 'read_failed') end
        local size = file:seek('end') or 0
        file:close()
        if size < 1024 or size > 50 * 1024 * 1024 then
            pcall(fs.remove, source)
            return result(false, 'file_size_invalid')
        end
        pcall(fs.create_directories, AUDIO_DIR)
        local normalized_ext = CUSTOM_EXTS[ext]
        if not normalized_ext then
            pcall(fs.remove, source)
            return result(false, 'unsupported_format')
        end
        local filename = 'custom_' .. key .. '.' .. normalized_ext
        local destination = join(AUDIO_DIR, filename)
        if not copy_file(source, destination) then
            pcall(fs.remove, source)
            return result(false, 'write_failed')
        end
        pcall(fs.remove, source)
        for oldext in pairs(CUSTOM_EXTS) do
            if oldext ~= normalized_ext then
                pcall(fs.remove, join(AUDIO_DIR, 'custom_' .. key .. '.' .. oldext))
                pcall(fs.remove, join(CUSTOM_BACKUP_DIR, 'custom_' .. key .. '.' .. oldext))
            end
        end
        local title = sanitize_text(type(metadata) == 'table' and metadata.title or '', 100)
        if title == '' or title:lower():find('error', 1, true) then title = 'YouTube ' .. id end
        local name = sanitize_text(game_name or '', 200)
        local stamp = os.time()
        custom[key] = {file=filename, title=title, name=name, ts=stamp}
        save_custom()
        custom_list_cache = nil
        -- Unlike the upstream backup sync, overwrite old backups when replacing a song.
        pcall(fs.create_directories, CUSTOM_BACKUP_DIR)
        copy_file(destination, join(CUSTOM_BACKUP_DIR, filename))
        sync_custom_backup()
        return result(true, nil, title)
    end)
    if not ok then
        logger:warn('set_youtube_custom_music failed: ' .. tostring(res))
        return result(false, 'internal_error')
    end
    return res
end
---@ffi
---Start a chunked custom music upload for a game.
---@param app_id number Steam app id
---@return string JSON { ok }
function set_custom_music_begin(app_id)
    local key = tostring(app_id)
    if key == "" or key == "nil" then return json.encode({ ok = false, error = "missing_app_id" }) end
    upload_sessions[key] = { parts = {}, bytes = 0 }
    return json.encode({ ok = true })
end

---@ffi
---Append a base64 chunk to an in-flight upload.
---@param app_id number Steam app id
---@param chunk string base64 fragment
---@return string JSON { ok }
function set_custom_music_chunk(app_id, chunk)
    local key = tostring(app_id)
    local s = upload_sessions[key]
    if not s then return json.encode({ ok = false, error = "no_session" }) end
    local part = tostring(chunk or "")
    s.bytes = s.bytes + #part
    if s.bytes > 80 * 1024 * 1024 then upload_sessions[key] = nil; return json.encode({ ok = false, error = "file_too_large" }) end
    s.parts[#s.parts + 1] = part
    return json.encode({ ok = true })
end

---@ffi
---Finish a chunked custom music upload and store the file.
---@param app_id number Steam app id
---@param ext string normalized audio extension
---@param title_b64 string base64 track title
---@param name_b64 string base64 game name
---@return string JSON { ok, url }
function set_custom_music_finish(app_id, ext, title_b64, name_b64)
    local ok, result = pcall(function()
        local key = tostring(app_id)
        local s = upload_sessions[key]
        if not s then return json.encode({ ok = false, error = "no_session" }) end
        local data = table.concat(s.parts)
        upload_sessions[key] = nil
        return store_custom(app_id, nil, nil, nil, data, ext, title_b64, name_b64)
    end)
    collectgarbage("collect")
    collectgarbage("collect")
    if not ok then logger:warn("set_custom_music_finish crashed: " .. tostring(result)); return json.encode({ ok = false, error = "internal_error" }) end
    return result
end

---@ffi
---Remove the custom music file for a game.
---@param app_id number Steam app id
---@return string JSON { ok }
function clear_custom_music(app_id)
    local ok, result = pcall(function()
        local key = tostring(app_id)
        if fs and fs.remove then
            for e in pairs(CUSTOM_EXTS) do
                pcall(fs.remove, join(AUDIO_DIR, "custom_" .. key .. "." .. e))
                pcall(fs.remove, join(CUSTOM_BACKUP_DIR, "custom_" .. key .. "." .. e))
            end
        end
        custom[key] = nil
        save_custom()
        sync_custom_backup()
        custom_list_cache = nil
        return json.encode({ ok = true })
    end)
    if not ok then logger:warn("clear_custom_music crashed: " .. tostring(result)); return json.encode({ ok = false, error = "internal_error" }) end
    return result
end

local FALLBACK_FILE = "fallback.mp3"

---@ffi
---Download one authorized YouTube audio track and make it the default fallback.
---@param video_url string
---@return string JSON { ok, error, title, file }
function set_youtube_fallback_music(video_url)
    local function result(ok, error, title, filename)
        return json.encode({ok=ok, error=error, title=title, file=filename})
    end
    if SEP ~= "\\" then return result(false, 'windows_only') end
    if not fs or not utils or type(utils.exec) ~= 'function' then return result(false, 'exec_unsupported') end
    local id = gts_video_id(video_url)
    if not id then return result(false, 'invalid_youtube_url') end
    local ok, res = pcall(function()
        ensure_data_dir()
        local executable = 'yt-dlp'
        local local_exe = join(DATA_DIR, 'yt-dlp.exe')
        if fs.exists(local_exe) then executable = '"' .. local_exe .. '"' end
        local _, check_status = utils.exec(executable .. ' --version')
        if check_status ~= 0 then return result(false, 'yt_dlp_missing') end
        local nonce = tostring(os.time()) .. '_' .. tostring(math.random(100000,999999))
        local stem = join(DATA_DIR, 'gts_youtube_fallback_' .. nonce)
        if stem:find('["%%!\r\n]') then return result(false, 'unsupported_install_path') end
        local cmd = executable
            .. ' --quiet --no-warnings --no-playlist --no-progress --no-part'
            .. ' --no-mtime --socket-timeout 20 --retries 2 --fragment-retries 2'
            .. ' --max-filesize 45M --write-info-json'
            .. ' -f "bestaudio[ext=m4a]/bestaudio"'
            .. ' -o "' .. stem .. '.%(ext)s"'
            .. ' "https://www.youtube.com/watch?v=' .. id .. '"'
        local _, status = utils.exec(cmd)
        local source, ext
        for _, candidate in ipairs({'m4a', 'webm', 'opus', 'ogg', 'mp3', 'aac', 'flac', 'wav'}) do
            local candidate_path = stem .. '.' .. candidate
            if fs.exists(candidate_path) then source, ext = candidate_path, candidate; break end
        end
        local metadata_file = stem .. '.info.json'
        local meta = safe_decode(read_file(metadata_file) or '')
        pcall(fs.remove, metadata_file)
        if status ~= 0 or not source then
            if source then pcall(fs.remove, source) end
            return result(false, 'download_failed')
        end
        local file = io.open(source, 'rb')
        if not file then pcall(fs.remove, source); return result(false, 'read_failed') end
        local size = file:seek('end') or 0
        file:close()
        if size < 1024 or size > 50 * 1024 * 1024 then
            pcall(fs.remove, source)
            return result(false, 'file_size_invalid')
        end
        local normalized_ext = CUSTOM_EXTS[ext]
        if not normalized_ext then
            pcall(fs.remove, source)
            return result(false, 'unsupported_format')
        end
        local filename = 'fallback.' .. normalized_ext
        pcall(fs.create_directories, AUDIO_DIR)
        if not copy_file(source, join(AUDIO_DIR, filename)) then
            pcall(fs.remove, source)
            return result(false, 'write_failed')
        end
        pcall(fs.remove, source)
        pcall(fs.create_directories, CUSTOM_BACKUP_DIR)
        copy_file(join(AUDIO_DIR, filename), join(CUSTOM_BACKUP_DIR, filename))
        -- Remove stale fallback formats only AFTER the new track was saved.
        for oldext in pairs(CUSTOM_EXTS) do
            if oldext ~= normalized_ext then
                pcall(fs.remove, join(AUDIO_DIR, 'fallback.' .. oldext))
                pcall(fs.remove, join(CUSTOM_BACKUP_DIR, 'fallback.' .. oldext))
            end
        end
        local title = sanitize_text(type(meta) == 'table' and meta.title or '', 100)
        if title == '' then title = 'YouTube ' .. id end
        settings.fallback_file = filename
        settings.fallback_title = title
        settings.fallback_ts = os.time()
        save_settings()
        sync_custom_backup()
        return result(true, nil, title, filename)
    end)
    if not ok then
        logger:warn('set_youtube_fallback_music failed: ' .. tostring(res))
        return result(false, 'internal_error')
    end
    return res
end

---@ffi
---Start a chunked default-song upload.
---@return string JSON { ok }
function set_fallback_begin()
    upload_sessions["__fallback__"] = { parts = {}, bytes = 0 }
    return json.encode({ ok = true })
end

---@ffi
---Append a base64 chunk to the default-song upload.
---@param chunk string base64 fragment
---@return string JSON { ok }
function set_fallback_chunk(chunk)
    local s = upload_sessions["__fallback__"]
    if not s then return json.encode({ ok = false, error = "no_session" }) end
    local part = tostring(chunk or "")
    s.bytes = s.bytes + #part
    if s.bytes > 80 * 1024 * 1024 then upload_sessions["__fallback__"] = nil; return json.encode({ ok = false, error = "file_too_large" }) end
    s.parts[#s.parts + 1] = part
    return json.encode({ ok = true })
end

---@ffi
---Finish the default-song upload and store it.
---@param title_b64 string base64 track title
---@return string JSON { ok, title }
function set_fallback_finish(title_b64)
    local ok, result = pcall(function()
        local s = upload_sessions["__fallback__"]
        if not s then return json.encode({ ok = false, error = "no_session" }) end
        local data = table.concat(s.parts)
        upload_sessions["__fallback__"] = nil
        local bytes = base64_decode(data)
        if #bytes < 1024 then return json.encode({ ok = false, error = "file_too_small" }) end
        if #bytes > 50 * 1024 * 1024 then return json.encode({ ok = false, error = "file_too_large" }) end
        pcall(fs.create_directories, AUDIO_DIR)
        if not write_file(join(AUDIO_DIR, FALLBACK_FILE), bytes) then return json.encode({ ok = false, error = "write_failed" }) end
        pcall(fs.create_directories, CUSTOM_BACKUP_DIR)
        copy_file(join(AUDIO_DIR, FALLBACK_FILE), join(CUSTOM_BACKUP_DIR, FALLBACK_FILE))
        for ext in pairs(CUSTOM_EXTS) do
            if ext ~= 'mp3' then
                pcall(fs.remove, join(AUDIO_DIR, 'fallback.' .. ext))
                pcall(fs.remove, join(CUSTOM_BACKUP_DIR, 'fallback.' .. ext))
            end
        end
        local title = sanitize_text(base64_decode(tostring(title_b64 or "")))
        if title == "" then title = "Default song" end
        settings.fallback_file = FALLBACK_FILE
        settings.fallback_title = title
        settings.fallback_ts = os.time()
        save_settings()
        return json.encode({ ok = true, title = title })
    end)
    collectgarbage("collect")
    collectgarbage("collect")
    if not ok then logger:warn("set_fallback_finish crashed: " .. tostring(result)); return json.encode({ ok = false, error = "internal_error" }) end
    return result
end

---@ffi
---Remove the default song.
---@return string JSON { ok }
function clear_fallback_music()
    local ok, result = pcall(function()
        if fs and fs.remove then
            for ext in pairs(CUSTOM_EXTS) do
                pcall(fs.remove, join(AUDIO_DIR, 'fallback.' .. ext))
                pcall(fs.remove, join(CUSTOM_BACKUP_DIR, 'fallback.' .. ext))
            end
        end
        settings.fallback_file = ""
        settings.fallback_title = ""
        settings.fallback_ts = 0
        save_settings()
        return json.encode({ ok = true })
    end)
    if not ok then logger:warn("clear_fallback_music crashed: " .. tostring(result)); return json.encode({ ok = false, error = "internal_error" }) end
    return result
end


local COLLECTION_EXT = ".gtscollection"
local COLLECTION_NL = string.char(10)
local COLLECTION_NAME = "game-theme-song-collection" .. COLLECTION_EXT
local COLLECTION_AUDIO_EXTS = { mp3 = true, ogg = true, oga = true, opus = true, m4a = true, mp4 = true, aac = true, wav = true, flac = true, webm = true }

local function copy_file_chunked(src, dst)
    local fin = io.open(src, "rb")
    if not fin then return false end
    local fout = io.open(dst, "wb")
    if not fout then fin:close() return false end
    while true do
        local chunk = fin:read(262144)
        if not chunk then break end
        fout:write(chunk)
    end
    fin:close()
    fout:close()
    return true
end

local function collection_files()
    local files = {}
    if fs and fs.list then
        local entries = fs.list(CUSTOM_BACKUP_DIR)
        if type(entries) == "table" then
            for _, e in ipairs(entries) do
                local name = tostring(e.name or "")
                local lower = name:lower()
                if e.is_file and (lower == "custom.json" or lower == "settings.json" or COLLECTION_AUDIO_EXTS[lower:match("%.(%w+)$") or ""]) then
                    files[#files + 1] = { name = name, size = tonumber(e.size) or file_size(join(CUSTOM_BACKUP_DIR, name)) }
                end
            end
        end
    end
    table.sort(files, function(a, b) return a.name < b.name end)
    return files
end

---@ffi
---Pack the custom collection folder into a single portable file.
---@return string JSON { ok, path, files }
function export_collection()
    return run_io("export_collection", function()
        if not fs then return json.encode({ ok = false, error = "fs_unsupported" }) end
        pcall(fs.create_directories, CUSTOM_BACKUP_DIR)
        local files = {}
        for _, f in ipairs(collection_files()) do
            if f.name ~= COLLECTION_NAME then files[#files + 1] = f end
        end
        if #files == 0 then return json.encode({ ok = false, error = "nothing_to_export" }) end
        local out_path = join(CUSTOM_BACKUP_DIR, COLLECTION_NAME)
        local out = io.open(out_path, "wb")
        if not out then return json.encode({ ok = false, error = "write_failed" }) end
        out:write("GTSC1" .. COLLECTION_NL)
        out:write(json.encode({ files = files }) .. COLLECTION_NL)
        for _, f in ipairs(files) do
            local fin = io.open(join(CUSTOM_BACKUP_DIR, f.name), "rb")
            if fin then
                while true do
                    local chunk = fin:read(262144)
                    if not chunk then break end
                    out:write(chunk)
                end
                fin:close()
            end
        end
        out:close()
        return json.encode({ ok = true, path = out_path, files = #files })
    end)
end

---@ffi
---Import a collection file previously written into the backup folder.
---@return string JSON { ok, files }
function import_collection()
    return run_io("import_collection", function()
        if not fs then return json.encode({ ok = false, error = "fs_unsupported" }) end
        local src = join(CUSTOM_BACKUP_DIR, COLLECTION_NAME)
        if not (fs.exists and fs.exists(src)) then return json.encode({ ok = false, error = "no_collection_file" }) end
        local fin = io.open(src, "rb")
        if not fin then return json.encode({ ok = false, error = "read_failed" }) end
        local magic = fin:read(6)
        if magic ~= "GTSC1" .. COLLECTION_NL then fin:close() return json.encode({ ok = false, error = "bad_format" }) end
        local header = fin:read("*l")
        local meta = safe_decode(header or "")
        if type(meta) ~= "table" or type(meta.files) ~= "table" then fin:close() return json.encode({ ok = false, error = "bad_format" }) end
        local restored = 0
        for _, f in ipairs(meta.files) do
            local name = tostring(f.name or "")
            if name:find("\\", 1, true) or name:find("/", 1, true) or name:match("%.%.") then
                -- skip unsafe names
            else
                local dst = join(CUSTOM_BACKUP_DIR, name)
                local fout = io.open(dst, "wb")
                if fout then
                    local remaining = tonumber(f.size) or 0
                    while remaining > 0 do
                        local chunk = fin:read(math.min(remaining, 262144))
                        if not chunk then break end
                        fout:write(chunk)
                        remaining = remaining - #chunk
                    end
                    fout:close()
                    restored = restored + 1
                end
            end
        end
        fin:close()
        pcall(function()
            load_state()
            restore_custom_backup()
            custom_list_cache = nil
        end)
        return json.encode({ ok = true, files = restored })
    end)
end

---@ffi
---Return the current plugin settings.
---@return string JSON settings table
function get_settings()
    local fresh = safe_decode(read_file(CONFIG_FILE))
    if type(fresh) == "table" then settings = merge_defaults(fresh, DEFAULT_SETTINGS) end
    if settings.manual_search ~= false or settings.confirm_before_download ~= false then
        settings.manual_search = false
        settings.confirm_before_download = false
        save_settings()
    end
    return json.encode(settings)
end

---@ffi
---Persist one settings key.
---@param key string settings key
---@param value string|number|boolean value to store
---@return string JSON { ok }
function set_setting(key, value)
    if DEFAULT_SETTINGS[key] == nil then return json.encode({ ok = false, error = "unknown_key" }) end
    -- Never allow retired UI modes to be re-enabled by stale clients.
    if key == 'manual_search' or key == 'confirm_before_download' then value = false end
    if key == 'volume_overrides' then
        -- JSON string passed via the existing primitive FFI settings bridge.
        if type(value) ~= 'string' or #value > 65536 then
            return json.encode({ ok = false, error = 'invalid_volume_map' })
        end
        local decoded = safe_decode(value)
        if type(decoded) ~= 'table' then return json.encode({ ok = false, error = 'invalid_volume_map' }) end
        local cleaned, count = {}, 0
        for appid, volume in pairs(decoded) do
            if type(appid) ~= 'string' or not appid:match('^[1-9]%d*$') or #appid > 12 or
                type(volume) ~= 'number' or volume ~= volume or volume < 0 or volume > 1 then
                return json.encode({ ok = false, error = 'invalid_volume_entry' })
            end
            count = count + 1
            if count > 500 then return json.encode({ ok = false, error = 'too_many_overrides' }) end
            cleaned[appid] = volume
        end
        value = cleaned
    end
    settings[key] = value
    if not write_file_atomic(CONFIG_FILE, json.encode(settings)) then return json.encode({ ok = false, error = "write_failed" }) end
    return json.encode({ ok = true })
end

local function file_size(path)
    local f = io.open(path, "rb")
    if not f then return 0 end
    local size = f:seek("end") or 0
    f:close()
    return size
end

local function audio_dir_sizes()
    local sizes = {}
    if fs and fs.list then
        local entries = fs.list(AUDIO_DIR)
        if type(entries) == "table" then
            for _, e in ipairs(entries) do
                if e.is_file then sizes[tostring(e.name)] = tonumber(e.size) or 0 end
            end
        end
    end
    return sizes
end

---@ffi
---Return downloaded track count and total size.
---@return string JSON { ok, count, bytes }
function get_cache_info()
    return run_io("get_cache_info", function()
        local sizes = audio_dir_sizes()
        local count, bytes = 0, 0
        for _, entry in pairs(cache) do
            if entry and entry.file and sizes[entry.file] then
                count = count + 1
                bytes = bytes + sizes[entry.file]
            end
        end
        return json.encode({ ok = true, count = count, bytes = bytes })
    end)
end

---@ffi
---Delete every downloaded theme track.
---@return string JSON { ok, removed }
function clear_audio_cache()
    local ok, result = pcall(function()
        local removed = 0
        for key, entry in pairs(cache) do
            if entry and entry.file then
                local path = join(AUDIO_DIR, entry.file)
                if fs and fs.exists and fs.exists(path) and pcall(fs.remove, path) then removed = removed + 1 end
            end
            for _, e in ipairs(AUDIO_EXTS) do
    pcall(fs.remove, join(AUDIO_DIR, tostring(key) .. "." .. e))
    pcall(fs.remove, join(AUDIO_DIR, tostring(key) .. "_b." .. e))
end
        end
        -- Clear persisted automatic audio as well; never retain data the
        -- user explicitly deleted. This folder only contains auto tracks.
        local backups = fs and fs.list and fs.list(AUTO_TRACK_DIR) or nil
        if type(backups) == 'table' then
            for _, item in ipairs(backups) do
                if item.is_file then
                    local base = tostring(item.name or '')
                    -- Includes recovery artifacts (.previous/.incoming).
                    if base:match('^%d+_?b?%.[%w]+') then
                        pcall(fs.remove, join(AUTO_TRACK_DIR, base))
                    end
                end
            end
        end
        cache = {}
        mem_cache.soundtrack = {}
        mem_cache.khinsider = {}
        mem_cache.track_mp3 = {}
        save_cache()
        return json.encode({ ok = true, removed = removed })
    end)
    if not ok then logger:warn("clear_audio_cache crashed: " .. tostring(result)); return json.encode({ ok = false, error = "internal_error" }) end
    return result
end

---@ffi
---Remove all managed theme tracks: cached downloads plus individual
---custom files (both live and backup copies) across every game.
---Does NOT remove the user's default fallback song or saved settings.
---@return string JSON { ok, removed_downloaded, removed_custom }
function clear_all_managed_theme_songs()
    local ok, result = pcall(function()
        local ids = {}
        for key in pairs(custom) do ids[#ids + 1] = key end
        local custom_removed, custom_failed = 0, 0
        for _, key in ipairs(ids) do
            local response = safe_decode(clear_custom_music(key))
            if type(response) == 'table' and response.ok then
                custom_removed = custom_removed + 1
            else
                custom_failed = custom_failed + 1
            end
        end
        -- Attempt cached-track deletion even if individual custom removals fail.
        local cache_response = safe_decode(clear_audio_cache())
        local cache_ok = type(cache_response) == 'table' and cache_response.ok
        if custom_failed > 0 or not cache_ok then
            return json.encode({ ok = false, error = 'partial_clear', removed_custom = custom_removed,
                failed_custom = custom_failed, removed_downloaded = cache_ok and cache_response.removed or 0 })
        end
        return json.encode({ ok = true, removed_custom = custom_removed,
            removed_downloaded = cache_response.removed or 0 })
    end)
    if not ok then
        logger:warn('clear_all_managed_theme_songs crashed: ' .. tostring(result))
        return json.encode({ ok = false, error = 'internal_error' })
    end
    return result
end

---@ffi
---Return count and total bytes of active, per-game custom audio files.
---Does not count backup copies or the global default fallback song.
---@return string JSON { ok, count, bytes }
function get_custom_storage_info()
    return run_io("get_custom_storage_info", function()
        local sizes = audio_dir_sizes()
        local count, bytes = 0, 0
        for _, entry in pairs(custom) do
            if type(entry) == 'table' and type(entry.file) == 'string'
                and sizes[entry.file] then
                count = count + 1
                bytes = bytes + sizes[entry.file]
            end
        end
        return json.encode({ ok = true, count = count, bytes = bytes })
    end)
end

---@ffi
---List downloaded theme tracks.
---@return string JSON { ok, items }
function get_cache_list()
    return run_io("get_cache_list", function()
        local sizes = audio_dir_sizes()
        local items, count = {}, 0
        for key, entry in pairs(cache) do
            if entry and entry.file and sizes[entry.file] then
                items[tostring(key)] = { title_b64 = base64_encode(sanitize_text(entry.title or "")), name_b64 = base64_encode(sanitize_text(entry.name or "")), bytes = sizes[entry.file], ts = entry.ts or 0 }
                count = count + 1
                if count >= MAX_LIST_ITEMS then break end
            end
        end
        return json.encode({ ok = true, items = items })
    end)
end

---@ffi
---Delete the downloaded theme track for one game.
---@param app_id number Steam app id
---@return string JSON { ok, bytes }
function clear_cache_for(app_id)
    local ok, result = pcall(function()
        local key = tostring(app_id)
        local entry = cache[key]
        local freed = 0
        if entry and entry.file then
            local path = join(AUDIO_DIR, entry.file)
            if fs and fs.exists and fs.exists(path) then freed = file_size(path) end
            pcall(fs.remove, path)
        end
        for _, e in ipairs(AUDIO_EXTS) do
    pcall(fs.remove, join(AUDIO_DIR, key .. "." .. e))
    pcall(fs.remove, join(AUDIO_DIR, key .. "_b." .. e))
end
        for _, ext in ipairs(AUDIO_EXTS) do
            gts_auto_forget_audio(key, key .. '.' .. ext)
            gts_auto_forget_audio(key, key .. '_b.' .. ext)
        end
        cache[key] = nil
        save_cache()
        return json.encode({ ok = true, bytes = freed })
    end)
    if not ok then logger:warn("clear_cache_for crashed: " .. tostring(result)); return json.encode({ ok = false, error = "internal_error" }) end
    return result
end

local MUSIC_BUTTON_PATCH = {
    find = [[\.AppButtonsContainer,children:\[\(0,(\w+)\.jsx\)\(\w+,\{\.\.\.this\.props\}\)]],
    file = [[chunk~[0-9a-f]+\.js]],
    transforms = {
        {
            match = [[\.AppButtonsContainer,children:\[\(0,(\w+)\.jsx\)]],
            replace = [[.AppButtonsContainer,children:[(0,\1.jsx)(#{{self}}?.hookedMusicButton?.MusicButton||(()=>null),{}),(0,\1.jsx)]],
        },
    },
}

local function on_load()
    pcall(migrate_all_data)
    local prev_boot = tonumber(read_file(BOOT_MARKER) or "") or 0
    if prev_boot >= 1 then
        -- A half-finished boot is NOT evidence that saved tracks are invalid.
        -- Preserve downloaded music and its index across updates/crashes.
        pcall(os.remove, RESOLVE_MARKER)
        if prev_boot >= 2 then
            local cdata = read_file(CUSTOM_FILE)
            if cdata and cdata ~= "" then write_file(CUSTOM_FILE .. ".bak", cdata) end
        end
        pcall(function() logger:warn("previous boot did not finish (attempt " .. prev_boot .. "); preserving downloaded music") end)
    end
    write_file(BOOT_MARKER, tostring(prev_boot + 1))
    gts_auto_restore_index()
    load_state()
    gts_auto_reconcile_tracks()
    restore_custom_backup()
    local prev = read_file(RESOLVE_MARKER)
    if prev and prev ~= "" then
        -- Preserve valid saved entries after an interrupted resolution.
        pcall(os.remove, RESOLVE_MARKER)
        pcall(function() logger:warn("stale resolve marker cleared; kept cached theme for app " .. prev) end)
    end
    pcall(os.remove, BOOT_MARKER)
    millennium.ready()
    cleanup_legacy_worker()
end

local function on_unload()
    pcall(os.remove, BOOT_MARKER)
    pcall(save_cache)
    pcall(save_settings)
    pcall(save_custom)
    pcall(save_ignored)
end

return { on_load = on_load, on_unload = on_unload, patches = { MUSIC_BUTTON_PATCH } }
