<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent to the NEW address: nothing changes until its link is opened. */
class ConfirmEmailChange extends Notification
{
    public function __construct(public string $url, public int $minutes) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirm your new e-mail address')
            ->line('Someone asked to use this address for a '.config('app.name').' account. Confirm it to make the change.')
            ->action('Confirm e-mail address', $this->url)
            ->line("This link works for {$this->minutes} minutes. If you did not ask for this, ignore this message: nothing will change.");
    }
}
