const puppeteer = require('puppeteer');
const should = require('should');

const pathToExtension = require('path').join(__dirname, '../..', 'demo-chrome');
const extensionUrl = "chrome-extension://fmhmiaejopepamlcjkncpgpdjichnecm/";
const extensionPath = {
    options: extensionUrl + 'options.html',
    popup: extensionUrl + 'popup.html',
};
const delayArg = {
    delay: 100
};

const pageSelectors = {
    options: {
        nav: {
            notActiveItem: ".nav-content > ul > li:not(.active) a",
            manageDatabases: ".nav-content > ul > li:nth-child(2) a",
        },
        manageDatabases: {
            checkboxes: "input[type='checkbox']",
        },
        document: {
            nav: "nav",
            container: "#contentbox",
        }
    },
    popup: {
        unlockLogo: ".unlockLogo",
        button: "button",
    }
};

describe('user acceptance test - views and setup', async function() {
    this.timeout(2 * 60 * 1000);
    let browser;

    before(async () => {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`
            ]
        });
    });

    after(async () => {
        await browser.close();
    });

    describe('options page', async function() {
        this.timeout(10 * 1000);
        let page;

        before(async () => {
            page = await browser.newPage();
            await page.goto(extensionPath.options);
        });

        after(async () => {
            await page.close();
        });

        it('should have the correct title', async () => {
            (await page.title()).should.equal("Tusk");
        });

        it('should have one nav element', async () => {
            (await page.$$(pageSelectors.options.document.nav)).length.should.be.exactly(1);
        });

        it('should change view after nav click', async () => {
            const bodySelector = pageSelectors.options.document.container;
            const prev = await page.$(bodySelector);
            const prevBody = await page.evaluate((el) => el.textContent, prev);
            await page.click(pageSelectors.options.nav.notActiveItem, delayArg);
            await page.waitFor(1000);
            const next = await page.$(bodySelector);
            (await page.evaluate((el) => el.textContent, next)).should.not.be.equal(prevBody);
        });

        it('should have more than one checkbox in manage databases view', async () => {
            try {
                await page.click(pageSelectors.options.nav.manageDatabases, delayArg);
            } catch (e) {
                throw new Error("Manage databases nav item not found")
            }
            await page.waitFor(500);
            (await page.$$(pageSelectors.options.manageDatabases.checkboxes)).length.should.be.greaterThan(1);
        });
    });

    describe('popup', async function() {
        this.timeout(10 * 1000);
        let page;

        before(async () => {
            page = await browser.newPage();
            await page.goto(extensionPath.popup);
        });

        after(async () => {
            await page.close();
        });

        it('should have only one button', async () => {
            (await page.$$(pageSelectors.popup.button)).length.should.be.exactly(1);
        });

        it('should have the name of the extension', async () => {
            const logo = await page.$(pageSelectors.popup.unlockLogo);
            (await page.evaluate((el) => el.textContent, logo)).includes("KeePass Tusk").should.be.true();
        });

        it('should lead to options on button click', async () => {
            await page.click("button", delayArg);
            await page.waitFor(1000);
            const openTabs = await browser.pages()
            openTabs.length.should.be.greaterThan(1);
            openTabs.filter(a => a.url().indexOf('options.html') > -1).length.should.be.exactly(1);
        })
    })
});