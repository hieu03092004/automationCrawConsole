bây giờ thay vì ghi vào file report.json hãy viết file này thành 1 hàm logic vẫn giữ nguyên để tránh truyền  sẽ có cấu trúc như tôi cung cấp thế này và file này sẽ export ra 1 biến là crawConsoleALLBrowser để hàm main dùng
Cấu trúc file craw.js
const BROWSER_OPTION = { chromium, firefox, webkit }
 const crawConsoleBrowser=async(crawParams = {})=>{
let { url } = crawParams
  const { browser } = crawParams
  if (!url || !browser) {
    throw new Error('Invalid payload input')
  } 
  const browserOS = BROWSER_OPTION[browser]
  if (!browserOS) {
    throw new Error('Can\'t support this browser')
  }
hàm này sẽ trả về là  logObject sẽ có logic như cũ lưu các logs là một mảng các keys hash tương ứng với values của các logs đó trong file hashDataLogs.json 
return { [browser]: logObject,
dưới đây là cấu trúc data mẫu khi return của hàm crawConsoleBrowser 
"chromium": {
      "screenshot": "url0-chromium.png",
      "logs": {
        "info": [
          "8qG1Hkj_FVeSgTmUGQTNN",
          "0PDnFIibyaQYDcqYxYYVY",
          "BAWcxqdupXQiQSihWovJY",
          "6t3lIdFIerVH4VIIgP9kg",
          "c5xa2LiVV6hNk7qWRwmpv",
          "dzldKHbRHhFTWgsrfXNiA",
          "PHcI5suiI9j7KZFZFJdIE"
        ],
        "warn": [
          "3QI_fO4llBrfseNtbFacv",
          "YtFTtZBJ-kPTb8DkqTaQi"
        ],
        "error": [
          "G-WH0Rd1-ct_7AJqfTd55",
          "YOhd01UTbkPC7FVKoli5B",
          "7cVd2UyK4eCF-uGhqCNX8",
          "zzAYPlySE9dCCmO-1yE4n"
        ]
      }
    },

}

const crawConsoleALLBrowser = async ({ url }) => {
  const consoles = {}
  
  for (const browser in BROWSER_OPTION) {
    if (Object.prototype.hasOwnProperty.call(BROWSER_OPTION, browser)) {
      const data = await crawConsoleBrowser({ url, browser })
      consoles[browser] = data[browser]
    }
  }
  return { consoles }
}
module.exports = {
  crawConsoleALLBrowser
}
và logic của hàm main sẽ truyền url qua, và url sẽ được thực hiện logic thông qua hai hàm để lưu vào mảng
Đây là output của hàm function getInput(file)
{
  Sitedeclaration: {
    Env: 'local',
    'Project Name': 'MyProject',
    BaseURL: 'https://shopee.vn',
    'Consolelog-Table': 'Pagesdeclarations'
  },
  Pagesdeclarations: [
    { URL: '/Thời-Trang-Nam-cat.11035567' },
    { URL: '/Điện-Thoại-Phụ-Kiện-cat.11036030' }
  ]
}
hãy kết hợp hai hàm lấy output của hàm getInput(file) sau đó chuẩn hóa bằng việc kết hợp với joinUrl
Để ra một mảng url chuẩn ,sau đó lặp qua và truyền qua url qua hàm 
crawConsoleALLBrowser
Cấu trúc data mong muốn trong file report/report.json sau khi hàm main trong file index.excel.js chạy xong
{
    "projectName": "MyProject",
    "buildNumber": 1718723456789,
    "items-object": {
      "https://shopee.vn/Thời-Trang-Nam-cat.11035567": {
            "chromium": {
                "screenshot": "url0-chromium.png",
                "logs": {
                    "info": [
                        "8qG1Hkj_FVeSgTmUGQTNN",
                        "0PDnFIibyaQYDcqYxYYVY",
                        "BAWcxqdupXQiQSihWovJY",
                        "6t3lIdFIerVH4VIIgP9kg",
                        "c5xa2LiVV6hNk7qWRwmpv",
                        "dzldKHbRHhFTWgsrfXNiA",
                        "PHcI5suiI9j7KZFZFJdIE"
                    ],
                    "warn": [
                        "3QI_fO4llBrfseNtbFacv",
                        "YtFTtZBJ-kPTb8DkqTaQi"
                    ],
                    "error": [
                        "G-WH0Rd1-ct_7AJqfTd55",
                        "YOhd01UTbkPC7FVKoli5B",
                        "7cVd2UyK4eCF-uGhqCNX8",
                        "zzAYPlySE9dCCmO-1yE4n"
                    ]
                }
            },
            "firefox": {
            "screenshot": "url0-firefox.png",
            "logs": {
                "info": [
                "mtWf-j9erzcsbOTJ_T8dC",
                "0PDnFIibyaQYDcqYxYYVY",
                "BAWcxqdupXQiQSihWovJY",
                "6t3lIdFIerVH4VIIgP9kg",
                "c5xa2LiVV6hNk7qWRwmpv",
                "dzldKHbRHhFTWgsrfXNiA",
                "PHcI5suiI9j7KZFZFJdIE"
                ],
                "warn": [
                "3FmFqSpqpfjBxd7GquPeR",
                "R93r30r6LXYSGr8BqBokk",
                "pHy2gMOO1DT2MIy5zLRMA",
                "3QI_fO4llBrfseNtbFacv",
                "UqMeVxLWfNRPVmBBQSJTg",
                "8feGlqQ4Z5RRgjnPJilMq",
                "1pySivj3Ch1_Ya_SVpoUX",
                "_d84oTAKdMKR7aQjlZQJf",
                "uOheSiA6UHQGWCQVQxOGC",
                "dUVbqz_cB8LwokbtEu3rx",
                "zkxZJpDIvWFCZfflFeBBC",
                "1mvJ_RIATInWGtcV6cLPu",
                "4rChJe4fjOIMqHlcqwmlw",
                "1CYfo-yhXWDU_ef-dHNx_",
                "Q5my-nr4JTAtvhaLGh7a1",
                "o3Wttzw3CwDpa8Tjkgv0Q",
                "EQfQg9SwKQHrD7nq4Lg6-",
                "kjR5AHAd4QXEbDZNu5eEV",
                "J_uzfLA-4iWIs_TM9r8zL",
                "TpvXv7H5B-uf3D_EMWiXx",
                "YZx6Ga0senUL5UHZft1VS",
                "Z99XbY4mYsHzN9EqsAEE_",
                "RVYtzQ11mT283CPKPgzAY",
                "X22DMN_cSlP-C979tb3Qh",
                "9FZS1rj_zf7AI2Y0YoZS-",
                "TvOYtVmAIIOmQDPoo3wV8",
                "jpej7XKd2kAAIa6OLTF7O",
                "ZUxKTjf86-LJ6RRmyBBM5",
                "ofsmS35PbOjumCRSpSKj6",
                "UZl3JNwLFbfwQGeTG0vla",
                "zO08-DrYPojvkm2Jtl8a5",
                "EV6HSNqQvgX-C9nv_O7dl",
                "59ZWuVlbUWLpJxRcC4HWN",
                "INshxc37tR_ilCFMffhI0",
                "WMOTk_A3tA16gwpLtcnYd",
                "b1DWZb3O3f7vn00HaeWLV",
                "MG0doXUf5e4f_5_Gqkpuj",
                "kLOjYO6OTqHRyXUNlwM9F"
                ],
                "error": [
                "UTJZ8cX05mcRXWrajXxGW",
                "RHSCdOj_cX3JKtZFme8Sc",
                "p_2jgxkVoJ8KM7z_FpbaH",
                "8EDPe-tTHEFNuAWnUCB4K",
                "lMhwi9l50jf31QAZtNxiS",
                "T8ejyEY4WYKyIImLpfvM1",
                "wXtD21j2tZgzDiHWhcAJA",
                "JvC7ZeeOCxs7JPn8c7DKy",
                "xINpKDD18t-YDqRfVZ3D1",
                "uGNzqXj2zs5IH4l8swxbk",
                "ncO1_znBSt7c77L-FIcV5",
                "rV6tiEjM3EqWq7K4bJmcz",
                "w1fO6kYg3cuaAMrSvKFhT",
                "Ayx2riAMJrO37-sYK08iz"
                ]
            }
            },
        } 
      "https://shopee.vn/Điện-Thoại-Phụ-Kiện-cat.11036030": {
            "chromium": {
                "screenshot": "url0-chromium.png",
                "logs": {
                    "info": [
                        "8qG1Hkj_FVeSgTmUGQTNN",
                        "0PDnFIibyaQYDcqYxYYVY",
                        "BAWcxqdupXQiQSihWovJY",
                        "6t3lIdFIerVH4VIIgP9kg",
                        "c5xa2LiVV6hNk7qWRwmpv",
                        "dzldKHbRHhFTWgsrfXNiA",
                        "PHcI5suiI9j7KZFZFJdIE"
                    ],
                    "warn": [
                        "3QI_fO4llBrfseNtbFacv",
                        "YtFTtZBJ-kPTb8DkqTaQi"
                    ],
                    "error": [
                        "G-WH0Rd1-ct_7AJqfTd55",
                        "YOhd01UTbkPC7FVKoli5B",
                        "7cVd2UyK4eCF-uGhqCNX8",
                        "zzAYPlySE9dCCmO-1yE4n"
                    ]
                }
            },
            "firefox": {
            "screenshot": "url0-firefox.png",
            "logs": {
                "info": [
                "mtWf-j9erzcsbOTJ_T8dC",
                "0PDnFIibyaQYDcqYxYYVY",
                "BAWcxqdupXQiQSihWovJY",
                "6t3lIdFIerVH4VIIgP9kg",
                "c5xa2LiVV6hNk7qWRwmpv",
                "dzldKHbRHhFTWgsrfXNiA",
                "PHcI5suiI9j7KZFZFJdIE"
                ],
                "warn": [
                "3FmFqSpqpfjBxd7GquPeR",
                "R93r30r6LXYSGr8BqBokk",
                "pHy2gMOO1DT2MIy5zLRMA",
                "3QI_fO4llBrfseNtbFacv",
                "UqMeVxLWfNRPVmBBQSJTg",
                "8feGlqQ4Z5RRgjnPJilMq",
                "1pySivj3Ch1_Ya_SVpoUX",
                "_d84oTAKdMKR7aQjlZQJf",
              
                ],
                "error": [
                    "UTJZ8cX05mcRXWrajXxGW",
                    "RHSCdOj_cX3JKtZFme8Sc",
                    "p_2jgxkVoJ8KM7z_FpbaH",
                    "8EDPe-tTHEFNuAWnUCB4K",
                    "lMhwi9l50jf31QAZtNxiS",
                    
                ]
            }
            },
      }
    }
  }
  
 

