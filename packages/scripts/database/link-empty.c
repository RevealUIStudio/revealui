/* Hard-link an open file descriptor to a new name (linkat AT_EMPTY_PATH).
 * Linux only. Loaded with dlopen; napi symbols resolve from the Node process.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct napi_env__ *napi_env;
typedef struct napi_value__ *napi_value;
typedef struct napi_callback_info__ *napi_callback_info;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
typedef int napi_status;
#define napi_ok 0

extern napi_status napi_get_cb_info(
  napi_env,
  napi_callback_info,
  size_t *,
  napi_value *,
  napi_value *,
  void **);
extern napi_status napi_get_value_int32(napi_env, napi_value, int32_t *);
extern napi_status napi_get_value_string_utf8(napi_env, napi_value, char *, size_t, size_t *);
extern napi_status napi_throw_error(napi_env, const char *, const char *);
extern napi_status napi_create_function(
  napi_env,
  const char *,
  size_t,
  napi_callback,
  void *,
  napi_value *);

#define NAPI_AUTO_LENGTH ((size_t) - 1)

static napi_value LinkEmpty(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  int32_t fd = -1;
  size_t length = 0;
  char *path = NULL;

  if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok || argc < 2)
    goto fail;
  if (napi_get_value_int32(env, args[0], &fd) != napi_ok) goto fail;
  if (napi_get_value_string_utf8(env, args[1], NULL, 0, &length) != napi_ok) goto fail;
  path = malloc(length + 1);
  if (path == NULL) goto fail;
  if (napi_get_value_string_utf8(env, args[1], path, length + 1, &length) != napi_ok) goto fail;
  if (linkat(fd, "", AT_FDCWD, path, AT_EMPTY_PATH) != 0) {
    napi_throw_error(env, "ERR_LINKAT", strerror(errno));
    free(path);
    return NULL;
  }
  free(path);
  return NULL;

fail:
  free(path);
  napi_throw_error(env, "ERR_LINKAT", "linkat failed");
  return NULL;
}

__attribute__((visibility("default"))) int32_t node_api_module_get_api_version_v1(void) {
  return 8;
}

__attribute__((visibility("default"))) napi_value napi_register_module_v1(
  napi_env env,
  napi_value exports) {
  napi_value fn;
  (void)exports;
  if (napi_create_function(env, "linkEmpty", NAPI_AUTO_LENGTH, LinkEmpty, NULL, &fn) != napi_ok)
    return NULL;
  return fn;
}
