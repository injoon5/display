#pragma once

#include <stdint.h>

void net_sync_seed_cache(const char *program_etag, const char *data_etag, uint32_t program_version, uint32_t data_version);
void net_sync_set_bearer_token(const char *token);
void net_sync_task(void *arg);
