/// Module: project_x_move
module project_x_move::batch;

use std::vector;
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

// --- Sabitler ve Hatalar ---
const FEE_BPS: u64 = 50;
const ELengthMismatch: u64 = 1;
const EInsufficientBalance: u64 = 2;

// --- Structs ---

public struct ServiceConfig has key {
    id: UID,
    owner: address,
}

/// 🎉 İŞTE EVENT YAPISI
/// `phantom T` kullanıyoruz ki hangi token (SUI, USDC, PEPE) dağıtıldıysa
/// event loglarında tipi "BatchTokenEvent<0x2::sui::SUI>" olarak görünsün.
/// Eventlerde `copy` ve `drop` yetenekleri zorunludur.
public struct BatchTokenEvent<phantom T> has copy, drop {
    sender: address, // Kim gönderdi?
    recipient_count: u64, // Kaç kişiye gitti?
    total_amount: u64, // Toplam ne kadar dağıtıldı?
    fee_amount: u64, // Servis ne kadar kazandı?
}

fun init(ctx: &mut TxContext) {
    let config = ServiceConfig {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
    };
    transfer::share_object(config);
}

// ================= TOKEN DAĞITIMI =================

public entry fun batch_send_token<T>(
    config: &ServiceConfig,
    payment: &mut Coin<T>,
    recipients: vector<address>,
    amounts: vector<u64>,
    ctx: &mut TxContext,
) {
    let len = vector::length(&recipients);
    assert!(len == vector::length(&amounts), ELengthMismatch);

    // 1. Toplam hesaplama
    let mut total_amount_to_send: u64 = 0;
    let mut i = 0;
    while (i < len) {
        total_amount_to_send = total_amount_to_send + *vector::borrow(&amounts, i);
        i = i + 1;
    };

    // 2. Fee Hesaplama
    let mut fee_amount = (total_amount_to_send * FEE_BPS) / 10000;
    // Eğer token değeri çok düşükse ve hesaplanan fee 0 ise, en az 1 birim al.
    if (fee_amount == 0 && total_amount_to_send > 0) {
        fee_amount = 1;
    };

    // Bakiye kontrolü: (Dağıtılacak + Fee) mevcut mu?
    assert!(coin::value(payment) >= (total_amount_to_send + fee_amount), EInsufficientBalance);

    // 3. Komisyonu al
    let fee_coin = coin::split(payment, fee_amount, ctx);
    transfer::public_transfer(fee_coin, config.owner);

    // 4. Dağıtım Döngüsü
    i = 0;
    while (i < len) {
        let recipient = *vector::borrow(&recipients, i);
        let amount = *vector::borrow(&amounts, i);

        let send_coin = coin::split(payment, amount, ctx);
        transfer::public_transfer(send_coin, recipient);

        i = i + 1;
    };

    // 5. 📢 EVENT EMIT ETME ZAMANI
    // İşlem başarılı olduktan sonra herkesin görebileceği o sinyali çakıyoruz.
    event::emit(BatchTokenEvent<T> {
        sender: tx_context::sender(ctx),
        recipient_count: len,
        total_amount: total_amount_to_send,
        fee_amount: fee_amount,
    });
}
