from playwright.sync_api import sync_playwright, expect

def test_onboarding_protection(page):
    # 1. Navigate to /onboarding
    print("Navigating to /onboarding...")
    page.goto("http://localhost:5173/onboarding")

    # 2. Wait for navigation
    page.wait_for_load_state('networkidle')

    # 3. Check URL. Should be redirected to / (Landing Page) because not authenticated.
    print(f"Current URL: {page.url}")

    # Expect URL to be http://localhost:5173/ (or with trailing slash)
    # The LandingPage is at /.

    # If not authenticated, App.tsx redirects /onboarding to /
    # But wait, App.tsx has:
    # <Route path="/onboarding" element={ isAuthenticated ? ... : <Navigate to="/" replace /> } />
    # So it should redirect.

    if page.url.rstrip('/') == "http://localhost:5173":
        print("✅ Redirected to landing page as expected (unauthenticated).")
    else:
        print(f"❌ Failed to redirect. URL: {page.url}")

    page.screenshot(path="verification_redirect.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            test_onboarding_protection(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
