#include <obs-module.h>

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE("kdr-camera", "en-US")

extern struct obs_source_info kdr_camera_source_info;

bool obs_module_load(void)
{
    obs_register_source(&kdr_camera_source_info);
    blog(LOG_INFO, "[KDR Camera] OBS source plugin loaded");
    return true;
}

void obs_module_unload(void)
{
    blog(LOG_INFO, "[KDR Camera] OBS source plugin unloaded");
}

const char *obs_module_name(void)
{
    return "KDR Camera";
}

const char *obs_module_description(void)
{
    return "KDR Multimedia camera source for OBS Studio.";
}
