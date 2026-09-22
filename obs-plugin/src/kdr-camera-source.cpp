#include <obs-module.h>
#include <obs.h>

#include <cstdio>
#include <string>

#define S_MODE "connection_mode"
#define S_SERVER "server_url"
#define S_ROOM "room"
#define S_PIN "pin"
#define S_CAPTURE_DEVICE "capture_device"
#define S_WIDTH "width"
#define S_HEIGHT "height"
#define S_FPS "fps"
#define S_TRANSPARENT "transparent"

struct kdr_camera {
    obs_source_t *source = nullptr;
    obs_source_t *browser = nullptr;
    obs_source_t *capture = nullptr;
    std::string url;
    uint32_t width = 1920;
    uint32_t height = 1080;
    int fps = 30;
};

static const char *kdr_get_name(void *) { return "KDR Camera"; }

static std::string trim_server(std::string value)
{
    while (!value.empty() && value.back() == '/') value.pop_back();
    if (value.empty()) value = "http://127.0.0.1:8080";
    return value;
}

static std::string encode_value(const char *value)
{
    std::string out;
    const char *v = value ? value : "";
    for (char c : std::string(v)) {
        if (c == ' ') out += "%20";
        else if (c == '#') out += "%23";
        else if (c == '?') out += "%3F";
        else if (c == '&') out += "%26";
        else out += c;
    }
    return out;
}

static std::string make_url(const char *server, const char *room, const char *pin)
{
    std::string url = trim_server(server ? server : "") + "/?room=";
    url += encode_value(room ? room : "KDRCAM");
    url += "&view=obs";
    if (pin && *pin) {
        url += "&pin=";
        url += pin;
    }
    return url;
}

static void release_source(obs_source_t *&source)
{
    if (source) {
        obs_source_release(source);
        source = nullptr;
    }
}

static void release_inputs(kdr_camera *data)
{
    release_source(data->browser);
    release_source(data->capture);
}

static void update_network(kdr_camera *data, obs_data_t *settings)
{
    const char *server = obs_data_get_string(settings, S_SERVER);
    const char *room = obs_data_get_string(settings, S_ROOM);
    const char *pin = obs_data_get_string(settings, S_PIN);

    data->width = (uint32_t)obs_data_get_int(settings, S_WIDTH);
    data->height = (uint32_t)obs_data_get_int(settings, S_HEIGHT);
    data->fps = (int)obs_data_get_int(settings, S_FPS);

    if (data->fps < 1) data->fps = 30;
    if (data->width < 320) data->width = 1920;
    if (data->height < 180) data->height = 1080;

    data->url = make_url(server, room, pin);

    obs_data_t *browser_settings = obs_data_create();
    obs_data_set_string(browser_settings, "url", data->url.c_str());
    obs_data_set_int(browser_settings, "width", data->width);
    obs_data_set_int(browser_settings, "height", data->height);
    obs_data_set_int(browser_settings, "fps", data->fps);
    obs_data_set_bool(browser_settings, "reroute_audio", false);
    obs_data_set_bool(browser_settings, "shutdown", false);
    obs_data_set_bool(browser_settings, "restart_when_active", true);

    release_source(data->browser);
    data->browser = obs_source_create_private("browser_source", "KDR Camera WebRTC", browser_settings);

    if (!data->browser)
        blog(LOG_ERROR, "[KDR Camera] Browser Source unavailable; install OBS Browser Source/obs-browser.");
    else
        blog(LOG_INFO, "[KDR Camera] Network input: %s", data->url.c_str());

    obs_data_release(browser_settings);
}

static void update_hdmi(kdr_camera *data, obs_data_t *settings)
{
    const char *device = obs_data_get_string(settings, S_CAPTURE_DEVICE);

    release_source(data->capture);

    if (!device || !*device) {
        blog(LOG_WARNING, "[KDR Camera] HDMI mode selected but no capture device was selected.");
        return;
    }

    obs_data_t *capture_settings = obs_data_create();
    obs_data_set_string(capture_settings, "video_device_id", device);
    obs_data_set_bool(capture_settings, "active", true);

    data->capture = obs_source_create_private(
        "dshow_input",
        "KDR HDMI Capture",
        capture_settings
    );

    if (!data->capture)
        blog(LOG_ERROR, "[KDR Camera] DirectShow input is unavailable. This HDMI shortcut currently targets Windows OBS.");
    else
        blog(LOG_INFO, "[KDR Camera] HDMI capture input: %s", device);

    obs_data_release(capture_settings);
}

static void kdr_update_input(kdr_camera *data, obs_data_t *settings)
{
    const char *mode = obs_data_get_string(settings, S_MODE);
    release_source(data->browser);
    release_source(data->capture);

    if (mode && std::string(mode) == "hdmi")
        update_hdmi(data, settings);
    else
        update_network(data, settings);
}

static void *kdr_create(obs_data_t *settings, obs_source_t *source)
{
    auto *data = new kdr_camera;
    data->source = source;
    kdr_update_input(data, settings);
    return data;
}

static void kdr_destroy(void *ptr)
{
    auto *data = static_cast<kdr_camera *>(ptr);
    if (!data) return;
    release_inputs(data);
    delete data;
}

static void kdr_update(void *ptr, obs_data_t *settings)
{
    auto *data = static_cast<kdr_camera *>(ptr);
    if (data) kdr_update_input(data, settings);
}

static void kdr_video_render(void *ptr, gs_effect_t *)
{
    auto *data = static_cast<kdr_camera *>(ptr);
    if (!data) return;

    const char *mode = nullptr;
    obs_data_t *settings = obs_source_get_settings(data->source);
    if (settings) {
        mode = obs_data_get_string(settings, S_MODE);
        if (mode && std::string(mode) == "hdmi") {
            if (data->capture) obs_source_video_render(data->capture);
        } else if (data->browser) {
            obs_source_video_render(data->browser);
        }
        obs_data_release(settings);
    }
}

static uint32_t kdr_width(void *ptr)
{
    auto *data = static_cast<kdr_camera *>(ptr);
    return data ? data->width : 1920;
}

static uint32_t kdr_height(void *ptr)
{
    auto *data = static_cast<kdr_camera *>(ptr);
    return data ? data->height : 1080;
}

static void kdr_defaults(obs_data_t *settings)
{
    obs_data_set_default_string(settings, S_MODE, "network");
    obs_data_set_default_string(settings, S_SERVER, "http://127.0.0.1:8080");
    obs_data_set_default_string(settings, S_ROOM, "KDRCAM");
    obs_data_set_default_string(settings, S_PIN, "");
    obs_data_set_default_string(settings, S_CAPTURE_DEVICE, "");
    obs_data_set_default_int(settings, S_WIDTH, 1920);
    obs_data_set_default_int(settings, S_HEIGHT, 1080);
    obs_data_set_default_int(settings, S_FPS, 30);
    obs_data_set_default_bool(settings, S_TRANSPARENT, false);
}

static bool kdr_mode_changed(obs_properties_t *props, obs_property_t *, obs_data_t *settings)
{
    const bool hdmi = std::string(obs_data_get_string(settings, S_MODE)) == "hdmi";
    obs_property_set_visible(obs_properties_get(props, S_SERVER), !hdmi);
    obs_property_set_visible(obs_properties_get(props, S_ROOM), !hdmi);
    obs_property_set_visible(obs_properties_get(props, S_PIN), !hdmi);
    obs_property_set_visible(obs_properties_get(props, S_CAPTURE_DEVICE), hdmi);
    return true;
}

static obs_properties_t *kdr_properties(void *)
{
    obs_properties_t *props = obs_properties_create();

    obs_property_t *mode = obs_properties_add_list(
        props, S_MODE, "Mode Koneksi",
        OBS_COMBO_TYPE_LIST, OBS_COMBO_FORMAT_STRING);
    obs_property_list_add_string(mode, "KDR Network (Wi-Fi / LAN / USB Network)", "network");
    obs_property_list_add_string(mode, "HDMI Capture (DirectShow)", "hdmi");
    obs_property_set_modified_callback(mode, kdr_mode_changed);

    obs_properties_add_text(props, S_SERVER, "KDR Server", OBS_TEXT_DEFAULT);
    obs_properties_add_text(props, S_ROOM, "Room / Camera ID", OBS_TEXT_DEFAULT);
    obs_properties_add_text(props, S_PIN, "PIN (optional)", OBS_TEXT_PASSWORD);

    obs_property_t *capture = obs_properties_add_list(
        props, S_CAPTURE_DEVICE, "HDMI Capture Device",
        OBS_COMBO_TYPE_LIST, OBS_COMBO_FORMAT_STRING);

    // Reuse OBS's DirectShow device enumeration so HDMI capture cards
    // appear in the KDR Camera source without duplicating Windows device code.
    obs_data_t *empty = obs_data_create();
    obs_source_t *probe = obs_source_create_private("dshow_input", "KDR Capture Probe", empty);
    if (probe) {
        obs_properties_t *dshow_props = obs_source_properties(probe);
        obs_property_t *devices = dshow_props ? obs_properties_get(dshow_props, "video_device_id") : nullptr;
        if (devices) {
            const size_t count = obs_property_list_item_count(devices);
            for (size_t i = 0; i < count; ++i) {
                const char *name = obs_property_list_item_name(devices, i);
                const char *value = obs_property_list_item_string(devices, i);
                if (name && value) obs_property_list_add_string(capture, name, value);
            }
        }
        if (dshow_props) obs_properties_destroy(dshow_props);
        obs_source_release(probe);
    }
    obs_data_release(empty);

    obs_properties_add_int(props, S_WIDTH, "Width", 320, 3840, 1);
    obs_properties_add_int(props, S_HEIGHT, "Height", 180, 2160, 1);
    obs_properties_add_int(props, S_FPS, "FPS", 1, 60, 1);
    obs_properties_add_bool(props, S_TRANSPARENT, "Transparent background");

    return props;
}

obs_source_info kdr_camera_source_info = {};

void kdr_camera_source_init()
{
    kdr_camera_source_info.id = "kdr_camera";
    kdr_camera_source_info.type = OBS_SOURCE_TYPE_INPUT;
    kdr_camera_source_info.output_flags = OBS_SOURCE_VIDEO;
    kdr_camera_source_info.get_name = kdr_get_name;
    kdr_camera_source_info.create = kdr_create;
    kdr_camera_source_info.destroy = kdr_destroy;
    kdr_camera_source_info.update = kdr_update;
    kdr_camera_source_info.get_defaults = kdr_defaults;
    kdr_camera_source_info.get_properties = kdr_properties;
    kdr_camera_source_info.video_render = kdr_video_render;
    kdr_camera_source_info.get_width = kdr_width;
    kdr_camera_source_info.get_height = kdr_height;
    kdr_camera_source_info.icon_type = OBS_ICON_TYPE_CAMERA;
}
