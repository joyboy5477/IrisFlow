#include <ApplicationServices/ApplicationServices.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_t worker;
static int workerStarted;
static int tapReady;
static int leftDown;
static char pendingName[32];
static char pendingState[8];
static int pending;
static CFMachPortRef tap;

static CGEventRef tapCallback(
    CGEventTapProxy proxy,
    CGEventType type,
    CGEventRef event,
    void *refcon
) {
  (void)proxy;
  (void)refcon;

  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    if (tap) CGEventTapEnable(tap, true);
    return event;
  }

  if (type == kCGEventFlagsChanged) {
    int64_t keyCode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
    if (keyCode == 59) {
      int isDown = (CGEventGetFlags(event) & kCGEventFlagMaskControl) ? 1 : 0;
      if (isDown != leftDown) {
        leftDown = isDown;
        pthread_mutex_lock(&mu);
        snprintf(pendingName, sizeof(pendingName), "LEFT CTRL");
        snprintf(pendingState, sizeof(pendingState), "%s", isDown ? "DOWN" : "UP");
        pending = 1;
        pthread_mutex_unlock(&mu);
      }
    }
  } else if (type == kCGEventKeyDown && leftDown) {
    pthread_mutex_lock(&mu);
    snprintf(pendingName, sizeof(pendingName), "OTHER");
    snprintf(pendingState, sizeof(pendingState), "DOWN");
    pending = 1;
    pthread_mutex_unlock(&mu);
  }

  return event;
}

static char tapStatus[64] = "idle";

static void setStatus(const char *value) {
  snprintf(tapStatus, sizeof(tapStatus), "%s", value);
}

static void *runTap(void *arg) {
  (void)arg;
  CGEventMask mask = ((CGEventMask)1 << kCGEventFlagsChanged) | ((CGEventMask)1 << kCGEventKeyDown);

  while (1) {
    setStatus(AXIsProcessTrusted() ? "creating" : "waiting-ax");
    tap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionListenOnly,
        mask,
        tapCallback,
        NULL
    );
    if (!tap) {
      tap = CGEventTapCreate(
          kCGHIDEventTap,
          kCGHeadInsertEventTap,
          kCGEventTapOptionListenOnly,
          mask,
          tapCallback,
          NULL
      );
    }
    if (tap) {
      CFRunLoopSourceRef source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0);
      CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
      CGEventTapEnable(tap, true);
      tapReady = 1;
      setStatus("ready");
      CFRunLoopRun();
      tapReady = 0;
      tap = NULL;
      setStatus("stopped");
    } else {
      setStatus("create-failed");
    }
    sleep(2);
  }
  return NULL;
}

void iris_keys_start(void) {
  if (workerStarted) return;
  workerStarted = 1;
  pthread_create(&worker, NULL, runTap, NULL);
  pthread_detach(worker);
}

int iris_keys_ready(void) {
  return tapReady;
}

int iris_keys_ax(void) {
  return AXIsProcessTrusted() ? 1 : 0;
}

void iris_keys_status(char *buf, int n) {
  if (!buf || n < 8) return;
  snprintf(buf, (size_t)n, "%s", tapStatus);
}

int iris_keys_poll(char *buf, int n) {
  if (!buf || n < 48) return 0;
  pthread_mutex_lock(&mu);
  if (!pending) {
    pthread_mutex_unlock(&mu);
    return 0;
  }
  snprintf(buf, (size_t)n, "{\"name\":\"%s\",\"state\":\"%s\"}", pendingName, pendingState);
  pending = 0;
  pthread_mutex_unlock(&mu);
  return 1;
}
