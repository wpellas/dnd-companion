<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent to the OLD address after the change, so a hijacked account does not switch its address unnoticed. */
class EmailChanged extends Notification
{
    public function __construct(public string $newEmail) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your e-mail address was changed')
            ->line("The e-mail address of your ".config('app.name')." account is now {$this->newEmail}.")
            ->line('If this was not you, ask the administrator to lock the account and reset the password.');
    }
}
