---
marp: true
theme: ainews-light
paginate: true
footer: "tamachi.go #2"
---

<!-- _class: title -->
<!-- _paginate: false -->
<!-- _footer: '' -->

# 大丈夫、届けました！<br>ESP32-S3のI2Cバグを直した話

tamachi.go #2
0hJonny — [@0hJonny](https://x.com/0hJonny)

<!--
こんばんは。0hJonnyです。
今日は、TinyGo の I2C のバグを直した話をします。
-->

---

<!-- _class: profile -->

## 自己紹介

<div class="row">

<img class="avatar" src="../_shared/avatar.png">

| | |
|---|---|
| 名前 | 0hJonny |
| 職種 | バックエンドエンジニア（C# → Go） |
| 出身 | ロシア |
| Go歴 | 2024年〜 |
| ひとこと | 東京で日本語を勉強中。秋葉原で買った e-ink バッジを TinyGo に移植中 |

</div>

<!--
ロシアから来ました。バックエンドエンジニアです。
今、東京で日本語を勉強しています。
このバッジを TinyGo に移植しています。
-->

---

<!-- _class: section -->

<span class="pill">01 / 04</span>

# 事件

<!--
まず、事件です。
-->

---

## I2C は「郵便屋さん」

- マイコンが *アドレス* に手紙（データ）を届ける
- 相手がいれば *ACK*：「受け取りました」
- いなければ *NACK*：「誰もいません」

![bg right:35% contain](img/gopher-postman.png)

<!--
I2C は郵便屋さんに似ています。
アドレスに手紙を届けて、相手がいれば ACK、いなければ NACK が返ってきます。
-->

---

## 事件：誰もいない家 0x42

```go
err := machine.I2C0.Tx(0x42, []byte{0x81, 0x40}, buf) // 読み込み
// err == nil, buf = 00 00 00 00（2回は 81 81 81 81）

err = machine.I2C0.Tx(0x42, []byte{0x81, 0x40}, nil)  // 書き込み
// err: i2c: error: expected ACK not NACK
```

- 書き込み → エラー
- 読み込み → `nil`…*「大丈夫、届けました！」*
- GT911 が応答しないときも、読み込みは `nil`

![bg right:28% contain](img/house-0x42.png)

<!--
誰もいないアドレス 0x42 に、読み込みと書き込みをしてみました。
書き込みはエラーになります。
でも読み込みは nil。郵便屋さんは「大丈夫、届けました！」と言います。
データはゼロでした。
タッチパネルの GT911 が応答しないときも、同じでした。
-->

---

<!-- _class: section -->

<span class="pill">02 / 04</span>

# 原因

<!--
では、原因です。
-->

---

## 原因：無視されていた NACK

- 読み込みコマンドに `ack_en` が付いていた
- → 読み込みが *成功しても* NACK が出る
- 読み込みの NACK は無視されていた（`&& !readLast`）
- → *本当の NACK も無視* された

```go
case mask&esp.I2C_INT_STATUS_NACK_INT_ST_Msk != 0 && !readLast:
	return errI2CAckExpected
```

![bg right:28% contain](img/nil-trash.png)

<!--
原因は二つありました。
一つ目、読み込みコマンドに ack_en が付いていました。そのため、読み込みが成功しても NACK が出ていました。
二つ目、読み込みの NACK は無視されていました。
その結果、本当に誰もいないときの NACK も無視されました。
-->

---

## 前の修正 <span class="pill">#5585</span> <span class="pill">#5602</span>

- 古い ESP32 では、同じバグがもう直っていた（#5585）
- 同じ修正を ESP32xx にコピー → *revert* された（#5602）
- `&& !readLast` は、そのまま残っていた

<!--
古い ESP32 では、同じバグがもう直っていました。
同じ修正が ESP32xx にもコピーされましたが、revert されました。
だから、このコードはそのまま残っていました。
-->

---

## どうやって確認したか

ESP-IDF v4.4 を参考に、*レジスタで同じトランザクションを作って比較*

| デバイスが ACK しているとき | コマンド | データ | NACK |
|---|---|---|---|
| `ack_en` あり | 全部完了 | 正しい | *出る* |
| `ack_en` なし | — | 正しい | 出ない |

- `ack_en` なしで 0x42 を読む → アドレスの NACK がちゃんと出る
- ESP-IDF は読み込みに `ack_en` を付けない

<!--
ESP-IDF と同じ処理を、レジスタで直接作って比べました。
ack_en があると、データは正しいのに NACK が出ます。
ack_en がなければ、NACK は出ません。
そして、誰もいない 0x42 を読むと、ちゃんと NACK が出ました。
ESP-IDF も、読み込みに ack_en を付けていません。
-->

---

<!-- _class: section -->

<span class="pill">03 / 04</span>

# 修正

<!--
では、修正です。
-->

---

## 修正 <span class="pill">PR #5774</span>

1. 読み込みに `ack_en` を付けない → *NACK は全部エラーとして返す*
2. アドレスを別の WRITE コマンドで送る → アドレスの NACK のあと固まらない
3. `resetMaster()` の SCL 9クロックを削除（そのあと GT911 が ACK しなかった）
4. 最後の1バイトを別に読む（64・96バイトの読み込みがタイムアウトした）

→ ESP32-S3 でテストして *マージ* 🎉

<!--
4つ直しました。
一番大事なのは、NACK をちゃんとエラーとして返すことです。
ESP32-S3 でテストして、マージされました！
-->

---

<!-- _class: section -->

<span class="pill">04 / 04</span>

# その後

<!--
では、その後です。
-->

---

## でも…ハードウェア CI が落ちた

- tinyhci（XIAO ESP32-C3 + MPU-6050）でテスト失敗
- bisect の結果：原因は 3 番、*SCL 9クロックの削除*
- MPU-6050 が、リセット後最初の `Configure()` で NACK
- 私は C3 と C6 のボードでテストできなかった

**組み込みは ガチャ 🎰**

<!--
でも、マージのあと、ハードウェア CI が落ちました。
原因は、私が消した 9 クロックでした。
別のボードの MPU-6050 が、最初の通信で NACK を返しました。
私は C3 のボードを持っていなかったので、テストできませんでした。
組み込みはガチャです。
-->

---

## 解決 <span class="pill">PR #5783</span>

- `Configure()` で *バスクリア* を追加：SDA が LOW の間 SCL をクロック → GPIO で STOP
- ESP-IDF v4.4.8 の `i2c_master_clear_bus` と同じ方法
- 私が GT911 で試した方法（9クロック + GPIO STOP）とも一致
- ESP32-S3 で再テスト：エラーなし

| テスト | 回数 |
|---|---|
| GT911 の読み込み | 1000 回 |
| 空きアドレス・PCF8563・GT911 の読み込み | 200 サイクル |

→ 39 チェック通過、*マージ* ✅

<!--
メンテナが、バスクリアを追加する PR を作りました。
ESP-IDF と同じ方法で、私が GT911 で試した方法とも同じでした。
私は ESP32-S3 で再テストして、エラーがないことを報告しました。
そしてマージされました。
-->

---

## まとめ

- `nil` でも、本当に届いたとは限らない
- NACK を無視すると、本当の NACK も見えなくなる
- 自分のボードで直っても、*別のボードで壊れる* こともある

<!--
nil でも、本当に届いたとは限りません。
NACK を無視すると、本当の NACK も見えなくなります。
そして、別のボードで壊れることもあります。
-->

---

<!-- _class: title -->
<!-- _footer: '' -->

# 大丈夫、今度はちゃんと<br>届けました！

ご清聴ありがとうございました
0hJonny — [@0hJonny](https://x.com/0hJonny)
[github.com/0hJonny/tinygo-lilygo-badge](https://github.com/0hJonny/tinygo-lilygo-badge)

<!--
でも、今度はちゃんと届けました！
ありがとうございました。
-->

---

## 参考文献

- issue #5767：I2C.Tx returns nil when a read is not acknowledged
  [github.com/tinygo-org/tinygo/issues/5767](https://github.com/tinygo-org/tinygo/issues/5767)
- PR #5774：fix I2C NACK handling and controller hang after an address NACK
  [github.com/tinygo-org/tinygo/pull/5774](https://github.com/tinygo-org/tinygo/pull/5774)
- PR #5783：clear the I2C bus with a GPIO STOP when configuring
  [github.com/tinygo-org/tinygo/pull/5783](https://github.com/tinygo-org/tinygo/pull/5783)
- PR #5585 / #5602：古い ESP32 の修正と、ESP32xx へのコピーの revert
- ESP-IDF v4.4.8 `driver/i2c.c`
  [github.com/espressif/esp-idf/blob/v4.4.8/components/driver/i2c.c](https://github.com/espressif/esp-idf/blob/v4.4.8/components/driver/i2c.c)
