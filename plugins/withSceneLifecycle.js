/*
 * Adopt the UIScene life cycle — but only when the local Xcode demands it.
 *
 * Apps built against the iOS 27 SDK (Xcode 27) abort at launch without it:
 *
 *   "Application failed to launch: UIScene life cycle is required for apps
 *    built with this SDK."
 *
 * Expo SDK 54's AppDelegate is the classic window-in-AppDelegate shape, and
 * its dev client reads `UIApplication.shared.delegate.window` during
 * didFinishLaunching, so the window cannot simply move into a scene delegate.
 * This does the smallest thing that satisfies UIKit instead: the AppDelegate
 * keeps creating the window exactly as before, and a SceneDelegate attaches
 * that existing window to the scene when it connects.
 *
 * Under scenes UIKit stops calling the AppDelegate's open-URL and
 * continue-userActivity methods, so the SceneDelegate forwards both back to
 * them — that is where Expo's subscribers (the dev launcher's deep link, among
 * others) and RCTLinkingManager are wired.
 *
 * GATED ON THE XCODE MAJOR VERSION, deliberately. EAS builds on the Xcode 26
 * image pinned in eas.json, where the app launches fine without scenes, and
 * this path has only ever been exercised in a local simulator. Leaving
 * production's launch sequence untouched is the point of the gate. It stops
 * being optional the day eas.json moves to an Xcode 27 image — by then the
 * right fix is an Expo SDK whose template adopts scenes itself, and this file
 * should be deleted rather than un-gated.
 */
const { execSync } = require("child_process");
const { withInfoPlist, withAppDelegate } = require("expo/config-plugins");

const FIRST_XCODE_REQUIRING_SCENES = 27;
const MARKER = "// withSceneLifecycle";

function localXcodeMajor() {
	try {
		const out = execSync("xcodebuild -version", {
			stdio: ["ignore", "pipe", "ignore"],
		}).toString();
		const match = out.match(/Xcode (\d+)/);
		return match ? Number(match[1]) : null;
	} catch {
		// No Xcode (Linux, CI, Android-only prebuild): nothing to adopt.
		return null;
	}
}

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }

    // The AppDelegate already built this window and started React Native in
    // it; adopt it rather than create a second one.
    if let existing = appDelegate.window {
      existing.windowScene = windowScene
      existing.frame = windowScene.coordinateSpace.bounds
      window = existing
      existing.makeKeyAndVisible()
    }

    // A cold start from a link arrives here, not in launchOptions.
    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace
      ]
      if let sourceApplication = context.options.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

module.exports = function withSceneLifecycle(config) {
	const xcodeMajor = localXcodeMajor();
	if (xcodeMajor === null || xcodeMajor < FIRST_XCODE_REQUIRING_SCENES) {
		return config;
	}

	config = withInfoPlist(config, (config) => {
		config.modResults.UIApplicationSceneManifest = {
			UIApplicationSupportsMultipleScenes: false,
			UISceneConfigurations: {
				UIWindowSceneSessionRoleApplication: [
					{
						UISceneConfigurationName: "Default Configuration",
						UISceneDelegateClassName:
							"$(PRODUCT_MODULE_NAME).SceneDelegate",
					},
				],
			},
		};
		return config;
	});

	return withAppDelegate(config, (config) => {
		if (config.modResults.language !== "swift") {
			throw new Error(
				"withSceneLifecycle: expected a Swift AppDelegate — the Expo template changed and this plugin needs updating.",
			);
		}
		if (!config.modResults.contents.includes(MARKER)) {
			config.modResults.contents += SCENE_DELEGATE;
		}
		return config;
	});
};
